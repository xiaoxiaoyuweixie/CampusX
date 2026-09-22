#!/usr/bin/env node
'use strict';

// Offline consistency checks only. This does not run a model or replace human annotation.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');

const directory = __dirname;
const read = name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
const gold = read('examples.gold.json');
const publicData = read('examples.public.json');
const privateData = read('user-cards.private.json');
const snapshotPath = path.resolve(directory, gold.metadata.sourceSnapshot.path);
const snapshotBytes = fs.readFileSync(snapshotPath);
const catalog = JSON.parse(snapshotBytes.toString('utf8'));
const errors = [];
let checkCount = 0;
function check(ok, code, detail) {
  checkCount += 1;
  if (!ok) errors.push({ code, detail });
  return ok;
}
const clone = value => JSON.parse(JSON.stringify(value));
const same = (a, b) => isDeepStrictEqual(a, b);
const sorted = values => [...values].sort();
const sameIds = (a, b) => Array.isArray(a) && Array.isArray(b) && same(sorted(a), sorted(b));
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const products = new Map(catalog.products.map(product => [product.productId, product]));
const annotations = new Map(catalog.annotations.map(annotation => [annotation.productId, annotation]));
const baseFields = ['itemType', 'categoryId', 'price', 'locationZone', 'condition'];
const operators = new Set(['eq', 'in', 'not_in', 'lte', 'gte', 'contains_all']);
const concepts = new Set(['高等数学', '线性代数', '概率统计', '英语词汇', '英语阅读', '英语写作', '政治基础概念', '数据结构']);
const blankSlot = () => ({ status: 'unmentioned', clauses: [], lastEventId: null });
const turnResults = [];
const cardResults = [];
const allEventIds = new Set();
const allClauseIds = new Set();

function checkEvidence(text, evidence, context) {
  check(Boolean(evidence) && Number.isInteger(evidence.start) && Number.isInteger(evidence.end)
    && evidence.start >= 0 && evidence.end > evidence.start && evidence.end <= text.length
    && text.slice(evidence.start, evidence.end) === evidence.quote,
  'evidence_offset', context);
}

function checkIdList(ids, context, requireOnSale = false) {
  if (!check(Array.isArray(ids), 'id_list_type', context)) return;
  check(new Set(ids).size === ids.length, 'duplicate_product_id', context);
  for (const id of ids) {
    check(products.has(id), 'unknown_product_id', { context, id });
    if (requireOnSale) check(products.get(id)?.status === 'on_sale', 'non_sale_result', { context, id });
  }
}

function checkKeys(object, allowed, context) {
  check(sameIds(Object.keys(object), allowed), 'unexpected_keys', { context, actual: Object.keys(object), allowed });
}

// These are explicit reviews of the fixed snapshot, not general language inference.
// An unreviewed relevant missing/null attribute causes failure instead of silently
// treating an incomplete annotation as proof that the product text is unknown.
const unknownFactReviews = [
  { productId: 'SYN-P020', field: 'attributes.轴体', storage: 'null', quote: '轴体名称没有记录', reason: '正文明确未记录轴体；输入正常不证明轴体类型。' },
  { productId: 'SYN-P074', field: 'attributes.版本标签', storage: 'null', quote: '版本标签暂未确认', reason: '未确认版本不能判为基础版。' },
  { productId: 'SYN-P048', field: 'attributes.调光方式', storage: 'null', quote: '未提供成色等级和调光档位信息', reason: '能够正常亮灯不证明调光档位。' },
  { productId: 'SYN-P014', field: 'attributes.按键特点', storage: 'missing', quote: '左右按键与滚轮目前正常', reason: '已检查完整正文；只说明按键正常，未说明是否静音。缺键在此确为未知。' },
  { productId: 'SYN-P015', field: 'attributes.按键特点', storage: 'null', quote: '没有确认是否属于静音款', reason: '正文明确未确认静音属性。' }
];
const reviewIndex = new Map(unknownFactReviews.map(review => [`${review.productId}:${review.field}`, review]));
const unknownReviewUses = new Map();

const knownFactsOutsideKey = [{
  productId: 'SYN-P039',
  requestedField: 'attributes.调光方式',
  knownField: 'attributes.亮度调节',
  knownValue: '无级调光',
  quote: '支持三色温和无级调光',
  reason: '同一调光事实另存于亮度调节键；不得因调光方式键缺失而认定正文未说明。',
  observedContexts: []
}];
const semanticReviewSnapshotSha256 = 'afc9b01239c340a7050ab10cbc856fea80aa7f5b764a5f4c7ea8953a8fa8f68d';

function getValue(product, field) {
  const annotation = annotations.get(product.productId);
  let value;
  if (field.startsWith('attributes.')) value = annotation.attributes[field.slice('attributes.'.length)];
  else if (field === 'price' || field === 'categoryId') value = product[field];
  else value = annotation[field];
  return value === undefined || value === null || value === '未说明' ? null : value;
}

function evaluateClause(product, field, clause) {
  const value = getValue(product, field);
  if (value === null) return 'unknown';
  let result;
  switch (clause.op) {
    case 'eq': result = same(value, clause.value); break;
    case 'in': result = clause.value.some(expected => same(value, expected)); break;
    case 'not_in': result = !clause.value.some(expected => same(value, expected)); break;
    case 'lte': result = typeof value === 'number' && value <= clause.value; break;
    case 'gte': result = typeof value === 'number' && value >= clause.value; break;
    case 'contains_all': {
      const actualConcepts = value.split(/[、与]/u);
      check(actualConcepts.every(concept => concepts.has(concept)), 'unsupported_content_concept', { productId: product.productId, value });
      result = clause.value.every(concept => actualConcepts.includes(concept));
      break;
    }
    default: throw new Error(`Unsupported operator: ${clause.op}`);
  }
  return result ? 'true' : 'false';
}

function checkRelevantUnknown(product, field, context) {
  const key = `${product.productId}:${field}`;
  check(reviewIndex.has(key), 'unreviewed_relevant_unknown', { context, productId: product.productId, field });
  if (!unknownReviewUses.has(key)) unknownReviewUses.set(key, new Set());
  unknownReviewUses.get(key).add(context);
}

function evaluateCatalog(slots, context) {
  const hard = [];
  const soft = [];
  for (const [field, slot] of Object.entries(slots)) {
    for (const clause of slot.clauses) (clause.strength === 'soft' ? soft : hard).push({ field, clause });
  }
  check(soft.length <= 1, 'multiple_soft_preferences_not_defined', context);
  const eligibleProductIds = [];
  const undeterminedProductIds = [];
  const undeterminedReasons = {};
  const relevanceByProductId = {};
  const preferredProductIds = [];
  const softUnknownProductIds = [];
  let falseCount = 0;
  let nonSaleCount = 0;
  for (const product of catalog.products) {
    if (product.status !== 'on_sale') { nonSaleCount += 1; continue; }
    const outcomes = hard.map(({ field, clause }) => ({ field, constraintId: clause.id, result: evaluateClause(product, field, clause) }));
    const hasFalse = outcomes.some(outcome => outcome.result === 'false');
    const unknown = outcomes.filter(outcome => outcome.result === 'unknown');
    for (const known of knownFactsOutsideKey) {
      if (known.productId !== product.productId || !outcomes.some(outcome => outcome.field === known.requestedField && outcome.result === 'unknown')) continue;
      const falseFields = outcomes.filter(outcome => outcome.result === 'false').map(outcome => outcome.field);
      known.observedContexts.push({ context, excludedByKnownFalseFields: falseFields });
      check(hasFalse, 'known_fact_missing_key_affects_result', { context, productId: product.productId, field: known.requestedField });
    }
    if (hasFalse) { falseCount += 1; continue; }
    if (unknown.length) {
      undeterminedProductIds.push(product.productId);
      undeterminedReasons[product.productId] = unknown;
      for (const outcome of unknown) checkRelevantUnknown(product, outcome.field, context);
      continue;
    }
    eligibleProductIds.push(product.productId);
    let relevance = 1;
    if (soft.length) {
      const { field, clause } = soft[0];
      const outcome = evaluateClause(product, field, clause);
      if (outcome === 'true') { relevance = 2; preferredProductIds.push(product.productId); }
      if (outcome === 'unknown') { softUnknownProductIds.push(product.productId); checkRelevantUnknown(product, field, context); }
    }
    relevanceByProductId[product.productId] = relevance;
  }
  return {
    eligibleProductIds,
    undeterminedProductIds,
    resultKind: eligibleProductIds.length ? 'nonempty' : undeterminedProductIds.length ? 'undetermined_only' : 'conclusive_empty',
    undeterminedReasons,
    preferredProductIds,
    relevanceByProductId,
    softUnknownProductIds,
    knownFalseProductCount: falseCount,
    excludedNonSaleProductCount: nonSaleCount
  };
}

function validateClause(clause, field, taskId, turnNumber) {
  check(clause && typeof clause.id === 'string' && clause.id.startsWith(`${taskId}:c`), 'constraint_id', { taskId, turnNumber, clause });
  if (!clause) return;
  check(!allClauseIds.has(clause.id), 'duplicate_constraint_id', clause.id);
  allClauseIds.add(clause.id);
  check(clause.sourceTurn === turnNumber, 'constraint_source_turn', clause.id);
  check(['hard', 'soft'].includes(clause.strength), 'constraint_strength', clause.id);
  check(operators.has(clause.op), 'constraint_operator', clause.id);
  check(clause.value !== undefined && clause.value !== null, 'constraint_value', clause.id);
  if (['in', 'not_in', 'contains_all'].includes(clause.op)) check(Array.isArray(clause.value) && clause.value.length > 0, 'set_operator_value', clause.id);
  if (['lte', 'gte'].includes(clause.op)) check(field === 'price' && Number.isFinite(clause.value), 'numeric_price_operator', clause.id);
  if (clause.op === 'contains_all') check(field === 'attributes.内容范围' && clause.value.every(concept => concepts.has(concept)), 'content_operator', clause.id);
}

const actualSha256 = crypto.createHash('sha256').update(snapshotBytes).digest('hex');
check(actualSha256 === gold.metadata.sourceSnapshot.sha256, 'snapshot_sha256', { expected: gold.metadata.sourceSnapshot.sha256, actual: actualSha256 });
check(actualSha256 === semanticReviewSnapshotSha256, 'semantic_review_requires_same_snapshot', { reviewed: semanticReviewSnapshotSha256, actual: actualSha256 });
check(catalog.metadata.datasetId === gold.metadata.sourceSnapshot.datasetId, 'snapshot_dataset_id', catalog.metadata.datasetId);
check(products.size === 100 && catalog.products.length === 100, 'catalog_product_count', products.size);
check(annotations.size === 100 && catalog.annotations.length === 100, 'catalog_annotation_count', annotations.size);
check(sameIds([...products.keys()], [...annotations.keys()]), 'catalog_product_annotation_ids', null);
let attributeCount = 0;
let explicitNullCount = 0;
let knownEvidenceCount = 0;
for (const product of catalog.products) {
  check(/^SYN-P\d{3}$/u.test(product.productId), 'catalog_id_format', product.productId);
  const annotation = annotations.get(product.productId);
  if (!annotation) continue;
  check(annotation.locationZone === product.location.split('·')[0], 'catalog_location_zone', product.productId);
  check(annotation.condition === '未说明' || product.description.includes(annotation.condition), 'catalog_condition_text', product.productId);
  check(sameIds(Object.keys(annotation.attributes), Object.keys(annotation.evidence)), 'catalog_evidence_keys', product.productId);
  for (const [field, value] of Object.entries(annotation.attributes)) {
    attributeCount += 1;
    const evidence = annotation.evidence[field];
    if (value === null) { explicitNullCount += 1; check(evidence === null, 'unknown_catalog_evidence', { productId: product.productId, field }); }
    else {
      knownEvidenceCount += 1;
      check(evidence?.field === 'description', 'catalog_evidence_field', { productId: product.productId, field });
      checkEvidence(product.description, evidence, { productId: product.productId, field });
      check(evidence?.quote === value, 'catalog_value_quote', { productId: product.productId, field });
    }
  }
}
check(attributeCount === 409 && explicitNullCount === 15, 'catalog_attribute_counts', { attributeCount, explicitNullCount });
for (const review of unknownFactReviews) {
  const product = products.get(review.productId);
  const attributes = annotations.get(review.productId).attributes;
  const key = review.field.slice('attributes.'.length);
  check(product.description.includes(review.quote), 'unknown_review_quote', review);
  check(review.storage === 'missing' ? !has(attributes, key) : attributes[key] === null, 'unknown_review_storage', review);
}
for (const known of knownFactsOutsideKey) {
  const product = products.get(known.productId);
  check(product.description.includes(known.quote) && getValue(product, known.knownField) === known.knownValue
    && getValue(product, known.requestedField) === null, 'known_fact_outside_key', known.productId);
}

check(new Set(gold.tasks.map(task => task.id)).size === gold.tasks.length, 'task_id_uniqueness', null);
check(gold.tasks.length === gold.metadata.taskCount && gold.tasks.length === 8, 'task_count', gold.tasks.length);
let annotatedTurnCount = 0;
for (const task of gold.tasks) {
  const reconstructed = Object.fromEntries(baseFields.map(field => [field, blankSlot()]));
  check(task.split === 'pilot_dev_only', 'pilot_split', task.id);
  for (const [turnIndex, turn] of task.turns.entries()) {
    annotatedTurnCount += 1;
    const context = `${task.id}:t${turn.turn}`;
    const errorsBeforeTurn = errors.length;
    check(turn.turn === turnIndex + 1, 'turn_sequence', context);
    check(Array.from(turn.userUtterance).length <= 200, 'user_input_length', context);
    for (const [eventIndex, event] of turn.events.entries()) {
      check(event.eventId === `${context}:e${eventIndex + 1}` && !allEventIds.has(event.eventId), 'event_id', event.eventId);
      allEventIds.add(event.eventId);
      check(baseFields.includes(event.field) || event.field.startsWith('attributes.'), 'event_field', event.eventId);
      checkEvidence(turn.userUtterance, event.evidence, event.eventId);
      if (!has(reconstructed, event.field)) reconstructed[event.field] = blankSlot();
      const slot = reconstructed[event.field];
      const targets = event.targetConstraintIds;
      check(Array.isArray(targets) && new Set(targets).size === targets.length, 'event_targets', event.eventId);
      const activeIds = slot.clauses.map(clause => clause.id);
      check(targets.every(id => activeIds.includes(id)), 'target_must_be_active_same_field', { eventId: event.eventId, targets, activeIds });
      if (event.action === 'add' || event.action === 'replace') {
        check(event.action === 'add' ? targets.length === 0 : targets.length > 0, 'add_replace_targets', event.eventId);
        validateClause(event.clause, event.field, task.id, turn.turn);
        check(sameIds(event.clause.supersedes, targets), 'supersedes_targets', event.eventId);
        slot.clauses = slot.clauses.filter(clause => !targets.includes(clause.id));
        slot.clauses.push(clone(event.clause));
        slot.status = 'constrained';
      } else if (event.action === 'withdraw') {
        check(event.clause === null && targets.length > 0, 'withdraw_shape', event.eventId);
        slot.clauses = slot.clauses.filter(clause => !targets.includes(clause.id));
        slot.status = slot.clauses.length ? 'constrained' : 'withdrawn';
      } else if (event.action === 'unrestrict') {
        check(event.clause === null && sameIds(targets, activeIds), 'unrestrict_all_active', event.eventId);
        slot.clauses = [];
        slot.status = 'unrestricted';
      } else check(false, 'unsupported_event_action', event.eventId);
      slot.lastEventId = event.eventId;
    }
    const snapshot = turn.state.slots;
    for (const field of new Set([...Object.keys(snapshot), ...Object.keys(reconstructed)])) {
      const expected = reconstructed[field] || blankSlot();
      const actual = snapshot[field] || blankSlot();
      check(same(actual, expected), 'slot_snapshot_mismatch', { context, field, actual, expected });
    }
    check(baseFields.every(field => has(snapshot, field)), 'base_slots_present', context);
    const statePassed = errors.length === errorsBeforeTurn;
    const computed = evaluateCatalog(reconstructed, context);
    checkIdList(turn.gold.eligibleProductIds, `${context}:eligible`, true);
    checkIdList(turn.gold.undeterminedProductIds, `${context}:undetermined`, true);
    check(!turn.gold.eligibleProductIds.some(id => turn.gold.undeterminedProductIds.includes(id)), 'overlapping_result_sets', context);
    const eligiblePassed = check(sameIds(computed.eligibleProductIds, turn.gold.eligibleProductIds), 'eligible_set_mismatch', { context, expected: computed.eligibleProductIds, actual: turn.gold.eligibleProductIds });
    const unknownPassed = check(sameIds(computed.undeterminedProductIds, turn.gold.undeterminedProductIds), 'undetermined_set_mismatch', { context, expected: computed.undeterminedProductIds, actual: turn.gold.undeterminedProductIds });
    const resultKindPassed = check(computed.resultKind === turn.gold.resultKind, 'result_kind_mismatch', context);
    turnResults.push({ taskId: task.id, turn: turn.turn, userUtterance: turn.userUtterance, statePassed, eligiblePassed, unknownPassed, resultKindPassed, reconstructedSlots: clone(reconstructed), ...computed });
  }
}
check(annotatedTurnCount === gold.metadata.annotatedTurnCount && annotatedTurnCount > 0, 'annotated_turn_count', annotatedTurnCount);

const publicErrorsBefore = errors.length;
checkKeys(publicData, ['metadata', 'tasks'], 'public root');
checkKeys(publicData.metadata, ['datasetId', 'warning'], 'public metadata');
check(publicData.metadata.datasetId === gold.metadata.datasetId, 'public_dataset_id', null);
check(sameIds(publicData.tasks.map(task => task.id), gold.tasks.map(task => task.id)), 'public_task_ids', null);
for (const task of publicData.tasks) {
  const original = gold.tasks.find(item => item.id === task.id);
  checkKeys(task, task.track === 'interactive' ? ['id', 'track', 'initialUserUtterance'] : ['id', 'track', 'initialUserUtterance', 'userTurns'], `public ${task.id}`);
  check(task.track === original?.track && task.initialUserUtterance === original?.turns[0].userUtterance, 'public_initial_turn', task.id);
  if (task.track === 'replay') {
    const expected = original.turns.map(turn => ({ turn: turn.turn, userUtterance: turn.userUtterance }));
    check(same(task.userTurns, expected), 'public_replay_turns', task.id);
    task.userTurns.forEach(turn => checkKeys(turn, ['turn', 'userUtterance'], `public ${task.id}:${turn.turn}`));
  }
}
const publicSchemaPassed = errors.length === publicErrorsBefore;

check(privateData.metadata.datasetId === gold.metadata.datasetId, 'private_dataset_id', null);
check(new Set(privateData.cards.map(card => card.id)).size === privateData.cards.length, 'private_card_id_uniqueness', null);
check(sameIds(privateData.cards.map(card => card.taskId), gold.tasks.filter(task => task.track === 'interactive').map(task => task.id)), 'interactive_card_coverage', null);
for (const card of privateData.cards) {
  const errorsBeforeCard = errors.length;
  const task = gold.tasks.find(item => item.id === card.taskId);
  check(card.id === task?.privateCardId && card.referenceGoldTaskId === task?.id, 'card_task_link', card.id);
  check(card.initialDisclosure === task?.turns[0].userUtterance, 'card_initial_disclosure', card.id);
  const slots = {};
  const add = (field, op, value) => {
    slots[field] = { status: 'constrained', clauses: [{ id: `${card.id}:${field}`, op, value, strength: 'hard', sourceTurn: null, supersedes: [] }], lastEventId: null };
  };
  checkKeys(card.fullGoal, ['itemType', 'maxPrice', 'locationZone', 'requiredAttributes', 'softPreferences', 'otherRequirements'], `card ${card.id} fullGoal`);
  add('itemType', 'eq', card.fullGoal.itemType);
  if (card.fullGoal.maxPrice !== null) add('price', 'lte', card.fullGoal.maxPrice);
  if (card.fullGoal.locationZone !== null) add('locationZone', 'eq', card.fullGoal.locationZone);
  for (const [field, value] of Object.entries(card.fullGoal.requiredAttributes)) add(`attributes.${field}`, 'eq', value);
  check(card.fullGoal.softPreferences.length === 0 && card.fullGoal.otherRequirements === null, 'unhandled_private_goal_field', card.id);
  const initiallyDisclosed = task.turns[0].state.slots;
  const hidden = Object.keys(slots).filter(field => !initiallyDisclosed[field] || initiallyDisclosed[field].status === 'unmentioned');
  check(sameIds(hidden, card.hiddenFieldsInDisclosurePriority), 'card_hidden_fields', { cardId: card.id, hidden });
  for (const field of Object.keys(slots)) check(typeof card.answersByField[field] === 'string', 'card_field_answer', { cardId: card.id, field });
  check(card.allowedRelaxations.length === 0, 'unsupported_card_relaxation', card.id);
  const computed = evaluateCatalog(slots, card.id);
  checkIdList(card.hiddenGoalEligibleProductIds, `${card.id}:eligible`, true);
  checkIdList(card.hiddenGoalUndeterminedProductIds, `${card.id}:undetermined`, true);
  check(sameIds(computed.eligibleProductIds, card.hiddenGoalEligibleProductIds), 'card_eligible_set', card.id);
  check(sameIds(computed.undeterminedProductIds, card.hiddenGoalUndeterminedProductIds), 'card_undetermined_set', card.id);
  cardResults.push({ cardId: card.id, taskId: card.taskId, passed: errors.length === errorsBeforeCard, ...computed });
}

const summary = {
  status: errors.length ? 'failed' : 'passed',
  taskCount: gold.tasks.length,
  annotatedTurnCount,
  catalogProductCount: catalog.products.length,
  catalogAttributeCount: attributeCount,
  checkedCatalogEvidenceCount: knownEvidenceCount,
  explicitNullAttributeCount: explicitNullCount,
  eventCount: allEventIds.size,
  createdConstraintCount: allClauseIds.size,
  privateCardCount: cardResults.length,
  checkCount,
  errorCount: errors.length,
  humanReviewed: false,
  modelExperimentsRun: false
};
const report = {
  datasetId: gold.metadata.datasetId,
  generatedAt: new Date().toISOString(),
  validator: 'validate-pilot.cjs',
  summary,
  sourceSnapshot: { path: gold.metadata.sourceSnapshot.path, expectedSha256: gold.metadata.sourceSnapshot.sha256, actualSha256, matches: actualSha256 === gold.metadata.sourceSnapshot.sha256 },
  scope: '对固定目录、事件、状态快照、三值集合、公开输入边界与私有需求卡做离线程序一致性检查；未调用模型。',
  limitations: [
    '程序从事件重建状态并独立枚举商品，但没有独立解析自然语言；用户原话到事件的语义仍须人工复核。',
    '属性来源有逐字证据；有关正文是否表达属性的检查包含模型编写的固定快照审计，不等于独立人工标注。',
    'public 文件字段检查不能替代实际运行器的权限隔离；本轮未运行任何被评方法。',
    '本版只定义每轮最多一项软偏好。relevance 仅对 eligible 商品赋值，待核验商品不参与合格结果排序。'
  ],
  informationBoundary: { publicExactSchemaPassed: publicSchemaPassed, interactiveInitialUtteranceOnly: publicSchemaPassed, runtimeIsolationImplemented: false },
  attributeCoverageAudit: {
    reviewerType: 'program_checks_plus_model_semantic_review_not_human',
    reviewedSnapshotSha256: semanticReviewSnapshotSha256,
    relevantUnknownFacts: unknownFactReviews.map(review => ({ ...review, contexts: [...(unknownReviewUses.get(`${review.productId}:${review.field}`) || [])] })),
    knownFactsOutsideRequestedKey: knownFactsOutsideKey
  },
  turns: turnResults,
  privateCards: cardResults,
  errors
};
fs.writeFileSync(path.join(directory, 'validation-report.json'), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  ...summary,
  report: path.join(directory, 'validation-report.json'),
  turns: turnResults.map(turn => ({
    id: `${turn.taskId}:t${turn.turn}`,
    statePassed: turn.statePassed,
    eligibleProductIds: turn.eligibleProductIds,
    undeterminedProductIds: turn.undeterminedProductIds,
    resultKind: turn.resultKind,
    preferredProductIds: turn.preferredProductIds
  })),
  errors
}, null, 2)}\n`);
if (errors.length) process.exitCode = 1;

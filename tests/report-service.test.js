const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { fixture } = require('./helpers/cloud');
const sharp = createRequire(require.resolve('../cloudfunctions/reportService/package.json'))('sharp');
const { imageInfo, MAX_IMAGE_BYTES } = require('../cloudfunctions/reportService/lib/image-format');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');
function pngChunk(type, body) {
  const chunk = Buffer.alloc(body.length + 12); chunk.writeUInt32BE(body.length); chunk.write(type, 4); body.copy(chunk, 8);
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, 8 + body.length)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, body.length + 8);
  return chunk;
}
function paddedPng(length) {
  return Buffer.concat([PNG.subarray(0, -12), pngChunk('ruST', Buffer.alloc(length - PNG.length - 12)), PNG.subarray(-12)]);
}
const payload = (submissionId = 'submission_0001', extra = {}) => ({ sessionId: 'S1', submissionId,
  reasonCode: 'other', detail: ' 举报说明\n保留原文 😀 ', attachments: [], ...extra });

async function reportFixture() {
  const f = fixture();
  const report = f.load('cloudfunctions/reportService/index.js');
  const password = crypto.randomBytes(16).toString('hex'), salt = crypto.randomBytes(12).toString('hex');
  f.tables().admins = { root: { _id: 'root', username: 'test-admin', nickname: '值班管理员', status: 'enabled', role: 'super_admin', salt,
    passwordHash: crypto.createHash('sha256').update(`${salt}:${password}`).digest('hex') } };
  const admin = f.load('cloudfunctions/adminService/index.js');
  const login = await admin.main({ action: 'login', data: { username: 'test-admin', password } });
  assert.equal(login.code, 0);
  const token = login.data.token;
  return { ...f, token, report: (action, data = {}) => report.main({ action, data }),
    admin: (action, data = {}) => admin.main({ action, data: { token, ...data } }) };
}
async function upload(f, submissionId = 'submission_0001', imageId = 'image_0001', bytes = PNG, extension = 'png') {
  const data = { sessionId: 'S1', submissionId, imageId, extension };
  const result = await f.report('prepareEvidence', data);
  assert.equal(result.code, 0, result.message);
  const saved = await f.cloud.uploadFile({ cloudPath: result.data.cloudPath, fileContent: bytes });
  return { imageId, fileId: saved.fileID };
}
const reports = f => Object.values(f.tables().reports || {});

test('empty conversations report the real peer independently of sending/contact/product status', async () => {
  for (const status of ['on_sale', 'off_shelf', 'sold']) {
    const f = await reportFixture();
    f.tables().products.product.status = status;
    f.tables().users.seller.status = 'disabled';
    const before = structuredClone(f.tables());
    const context = await f.report('getContext', { sessionId: 'S1' });
    assert.equal(context.code, 0);
    assert.deepEqual(context.data, { sessionId: 'S1', product: { productId: 'P1', title: '教材' }, peer: { openid: 'seller', nickname: '卖家' } });
    const result = await f.report('submit', payload(undefined, { reportedOpenid: 'outsider', reporterOpenid: 'seller', productId: 'forged' }));
    assert.equal(result.code, 0);
    const record = reports(f)[0];
    assert.equal(record.reporterOpenid, 'buyer'); assert.equal(record.reported.openid, 'seller');
    assert.equal(record.product.productId, 'P1'); assert.equal(record.status, 'pending');
    assert.equal(record.detail, payload().detail);
    assert.deepEqual(f.tables().chat_sessions, before.chat_sessions);
    assert.deepEqual(f.tables().chat_messages, {});
    assert.deepEqual(f.tables().products, before.products);
    assert.deepEqual(f.tables().users, before.users);
    assert.equal(JSON.stringify(record).includes('abcdef'), false);
    assert.deepEqual(Object.keys(result.data).sort(), ['reportId', 'submissionId', 'submitted']);
  }
});

test('missing objects, outsiders, disabled and missing reporters cannot create reports', async () => {
  for (const mutate of [f => { delete f.tables().chat_sessions.session; }, f => { delete f.tables().products.product; },
    f => { delete f.tables().users.seller; }, f => { f.state.openid = 'outsider'; },
    f => { f.tables().users.buyer.status = 'disabled'; }, f => { delete f.tables().users.buyer; }, f => { f.state.openid = ''; }]) {
    const f = await reportFixture(); mutate(f);
    assert.notEqual((await f.report('getContext', { sessionId: 'S1' })).code, 0);
    assert.notEqual((await f.report('submit', payload())).code, 0);
    assert.equal(reports(f).length, 0);
  }
});

test('new submission rechecks current account, participation and related records in final transaction', async () => {
  for (const mutate of [f => { f.tables().users.buyer.status = 'disabled'; }, f => { f.tables().chat_sessions.session.participants = ['seller']; },
    f => { delete f.tables().products.product; }, f => { delete f.tables().users.seller; }, f => { delete f.tables().chat_sessions.session; }]) {
    const f = await reportFixture();
    const original = f.db.runTransaction; let count = 0;
    f.db.runTransaction = callback => { count++; if (count === 3) mutate(f); return original(callback); };
    assert.notEqual((await f.report('submit', payload())).code, 0);
    assert.equal(reports(f).length, 0);
    assert.equal(Object.values(f.tables().report_pending_guards || {}).length, 0);
  }
});

test('reason, Unicode codepoint length, whitespace and attachment limits are server-enforced', async () => {
  const f = await reportFixture();
  for (const reasonCode of ['', 'bogus', null]) assert.equal((await f.report('submit', payload(undefined, { reasonCode }))).message, '请选择举报原因');
  for (const detail of ['', ' \n\t', null, 10]) assert.equal((await f.report('submit', payload(undefined, { detail }))).message, '请输入详细信息');
  assert.equal((await f.report('submit', payload(undefined, { detail: '😀'.repeat(101) }))).message, '详细信息最多输入100字');
  assert.equal((await f.report('submit', payload(undefined, { attachments: Array(10).fill({}) }))).message, '最多上传9张截图');
  assert.equal((await f.report('submit', payload(undefined, { detail: '😀'.repeat(100) }))).code, 0);
  assert.equal(Array.from(reports(f)[0].detail).length, 100);
});

test('simultaneous identical requests create one record and return the same permanent receipt', async () => {
  const f = await reportFixture();
  const results = await Promise.all(Array.from({ length: 6 }, () => f.report('submit', payload())));
  assert.ok(results.every(result => result.code === 0));
  assert.equal(new Set(results.map(result => result.data.reportId)).size, 1);
  assert.equal(reports(f).length, 1);
  assert.deepEqual((await f.report('getSubmissionResult', { submissionId: payload().submissionId })).data, results[0].data);
});

test('distinct concurrent attempts allow one pending per reporter/session; reverse report is independent', async () => {
  const f = await reportFixture();
  const results = await Promise.all(['submission_0001', 'submission_0002', 'submission_0003'].map(id => f.report('submit', payload(id))));
  assert.equal(results.filter(result => result.code === 0).length, 1);
  assert.ok(results.filter(result => result.code !== 0).every(result => result.message === '该会话已有待处理举报，请勿重复提交'));
  f.state.openid = 'seller';
  const reverse = await f.report('submit', payload('submission_0004'));
  assert.equal(reverse.code, 0);
  assert.equal(reports(f).length, 2);
  assert.equal(reports(f).find(record => record.reporterOpenid === 'seller').reported.openid, 'buyer');
});

test('same submission ID cannot overwrite content and own receipts survive missing related objects and lost access', async () => {
  const f = await reportFixture();
  const first = await f.report('submit', payload());
  assert.equal((await f.report('submit', payload(undefined, { detail: '不同材料' }))).code, 409);
  f.tables().chat_sessions.session.participants = ['seller'];
  assert.deepEqual((await f.report('submit', payload())).data, first.data);
  delete f.tables().chat_sessions.session; delete f.tables().products.product; delete f.tables().users.seller;
  assert.equal((await f.report('getContext', { sessionId: 'S1' })).code, 404);
  assert.deepEqual((await f.report('submit', payload())).data, first.data);
  const receipt = await f.report('getSubmissionResult', { submissionId: payload().submissionId });
  assert.deepEqual(receipt.data, first.data);
  assert.equal(JSON.stringify(receipt.data).includes('pending'), false);
  f.state.openid = 'outsider';
  assert.deepEqual((await f.report('getSubmissionResult', { submissionId: payload().submissionId })).data, { submitted: false });
  assert.equal((await f.report('getReportDetail', { reportId: first.data.reportId })).code, 400);
  assert.equal((await f.report('getReportEvidence', { reportId: first.data.reportId, imageId: 'image_0001' })).code, 400);
  f.state.openid = 'buyer'; f.tables().users.buyer.status = 'disabled';
  assert.equal((await f.report('getSubmissionResult', { submissionId: payload().submissionId })).code, 403);
});

test('prepare is stable, server verifies ownership and format, copies immutable evidence in selected order', async () => {
  const f = await reportFixture();
  const args = { sessionId: 'S1', submissionId: payload().submissionId, imageId: 'image_0001', extension: 'png' };
  const prepared = await f.report('prepareEvidence', args);
  assert.deepEqual((await f.report('prepareEvidence', args)).data, prepared.data);
  const first = await upload(f), second = await upload(f, payload().submissionId, 'image_0002');
  const result = await f.report('submit', payload(undefined, { attachments: [second, first] }));
  assert.equal(result.code, 0, result.message);
  const record = reports(f)[0];
  assert.deepEqual(record.attachments.map(image => image.imageId), ['image_0002', 'image_0001']);
  assert.ok(record.attachments.every(image => image.fileId.includes('/report-evidence/') && image.width === 1 && image.height === 1 && image.size === PNG.length));
  f.state.files.set(first.fileId, Buffer.from('tampered')); f.state.files.delete(second.fileId);
  assert.ok(record.attachments.every(image => f.state.files.get(image.fileId).equals(PNG)));
  const detail = await f.admin('getReportDetail', { reportId: result.data.reportId });
  assert.ok(detail.data.attachments.every(image => !Object.hasOwn(image, 'fileId') && !Object.hasOwn(image, 'digest')));
  assert.equal((await f.chat('getImage', { sessionId: 'S1', messageId: result.data.reportId })).code, 40400);
  assert.equal((await f.admin('getReportEvidence', { reportId: result.data.reportId, imageId: first.imageId })).code, 0);
});

test('foreign, cross-attempt, unknown uploads, animated and disguised files fail without partial reports', async () => {
  const f = await reportFixture();
  const owned = await upload(f);
  let sequence = 0;
  for (const attachment of [{ ...owned, fileId: owned.fileId.replace('test.bucket', 'foreign.bucket') },
    { ...owned, fileId: 'cloud://test.bucket/report-staging/buyer/forged.png' }, { ...owned, imageId: 'image_unknown' }]) {
    assert.equal((await f.report('submit', payload(`submission_foreign${++sequence}`, { attachments: [attachment] }))).code, 403);
  }
  f.state.openid = 'seller';
  assert.equal((await f.report('submit', payload(undefined, { attachments: [owned] }))).code, 403);
  f.state.openid = 'buyer';
  const bad = await upload(f, 'submission_0003', 'image_0002', Buffer.from('not a PNG'));
  assert.equal((await f.report('submit', payload('submission_0003', { attachments: [bad] }))).message, '暂不支持该图片格式');
  assert.equal(reports(f).length, 0);
  const chunk = pngChunk('acTL', Buffer.alloc(8));
  const animated = Buffer.concat([PNG.subarray(0, 33), chunk, PNG.subarray(33)]);
  assert.equal(imageInfo(animated), null);
  const large = await upload(f, 'submission_0004', 'image_0001', Buffer.alloc(MAX_IMAGE_BYTES + 1));
  assert.equal((await f.report('submit', payload('submission_0004', { attachments: [large] }))).message, '单张图片不能超过10MB');
  const ok = await upload(f, 'submission_0005', 'image_0001');
  const missing = await upload(f, 'submission_0005', 'image_0002'); f.state.files.delete(missing.fileId);
  assert.equal((await f.report('submit', payload('submission_0005', { attachments: [ok, missing] }))).message, '截图上传失败，请重试');
  assert.equal(reports(f).length, 0);
});

test('failed or ambiguously committed submissions preserve evidence and do not return false success', async () => {
  const f = await reportFixture();
  const attachment = await upload(f);
  const original = f.db.runTransaction; let count = 0;
  f.db.runTransaction = async callback => {
    count++;
    const result = await original(callback);
    if (count === 3) throw new Error('response lost after commit');
    return result;
  };
  const result = await f.report('submit', payload(undefined, { attachments: [attachment] }));
  assert.equal(result.code, 500);
  assert.equal(reports(f).length, 1);
  assert.ok(f.state.files.has(reports(f)[0].attachments[0].fileId));
  assert.equal((await f.report('getSubmissionResult', { submissionId: payload().submissionId })).data.submitted, true);
  assert.equal((await f.report('submit', payload(undefined, { attachments: [attachment] }))).code, 0);
});

test('admin list defaults pending, filters, stable tie ordering, fixed pagination and empty-page clamp', async () => {
  const f = await reportFixture();
  for (let i = 1; i <= 45; i++) {
    const id = i.toString(16).padStart(64, '0');
    await f.db.collection('reports').doc(id).set({ data: { status: i <= 42 ? 'pending' : 'substantiated',
      createdAt: '2026-09-12T00:00:00Z', reporter: {}, reported: {}, product: {} } });
  }
  const first = (await f.admin('listReports')).data;
  assert.equal(first.total, 42); assert.equal(first.list.length, 20); assert.equal(first.pageSize, 20);
  assert.equal(parseInt(first.list[0].reportId, 16), 42);
  const second = (await f.admin('listReports', { page: 2, pageSize: 1 })).data;
  assert.equal(second.pageSize, 20); assert.equal(second.list.length, 20);
  assert.equal(new Set([...first.list, ...second.list].map(item => item.reportId)).size, 40);
  assert.equal((await f.admin('listReports', { page: 99 })).data.page, 3);
  assert.equal((await f.admin('listReports', { status: 'all' })).data.total, 45);
  assert.equal((await f.admin('listReports', { status: 'unsubstantiated' })).data.total, 0);
  assert.equal((await f.admin('listReports', { status: 'invalid' })).code, 400);
});

test('super-admin-only detail, evidence and processing remain possible after related objects disappear', async () => {
  const f = await reportFixture();
  const attachment = await upload(f);
  const saved = await f.report('submit', payload(undefined, { attachments: [attachment] })), id = saved.data.reportId;
  for (const [action, data] of [['listReports', {}], ['getReportDetail', { reportId: id }],
    ['getReportEvidence', { reportId: id, imageId: attachment.imageId }], ['processReport', { reportId: id, result: 'substantiated', remark: '已核实' }]]) {
    assert.equal((await f.admin(action, { ...data, token: '' })).code, 40004);
    f.tables().admins.root.role = 'viewer'; assert.equal((await f.admin(action, data)).code, 40004);
    f.tables().admins.root.role = 'super_admin'; f.tables().admins.root.status = 'disabled';
    assert.equal((await f.admin(action, data)).code, 40004); f.tables().admins.root.status = 'enabled';
  }
  delete f.tables().users.seller; delete f.tables().users.buyer; delete f.tables().products.product; delete f.tables().chat_sessions.session;
  const detail = await f.admin('getReportDetail', { reportId: id });
  assert.equal(detail.code, 0); assert.equal(detail.data.detail, payload().detail);
  assert.deepEqual(detail.data.related, { reporterExists: false, reportedExists: false, productExists: false, sessionExists: false,
    reporterId: 'buyer', reportedId: 'seller', productId: 'product' });
  assert.equal((await f.admin('getReportEvidence', { reportId: id, imageId: attachment.imageId })).code, 0);
  assert.equal((await f.admin('getReportEvidence', { reportId: id, imageId: 'image_missing' })).code, 404);
  assert.equal((await f.admin('processReport', { reportId: id, result: 'unsubstantiated', remark: '材料不足' })).code, 0);
});

test('atomic admin decision is irreversible, actor is authoritative, and sanctions are separate', async () => {
  const f = await reportFixture();
  const saved = await f.report('submit', payload()), id = saved.data.reportId;
  const before = structuredClone({ users: f.tables().users, products: f.tables().products });
  for (const [extra, message] of [[{ result: '' }, '请选择处理结果'], [{ remark: '\n ' }, '请输入处理备注'],
    [{ remark: '😀'.repeat(201) }, '处理备注最多输入200字']]) {
    const result = await f.admin('processReport', { reportId: id, result: 'substantiated', remark: '核实', ...extra });
    assert.equal(result.message, message);
  }
  const decisions = await Promise.all(['substantiated', 'unsubstantiated'].map(result => f.admin('processReport', {
    reportId: id, result, remark: ' 原文\n核实 😀 ', adminId: 'forged', adminName: 'forged', processedAt: 'forged',
  })));
  assert.equal(decisions.filter(item => item.code === 0).length, 1);
  assert.equal(decisions.filter(item => item.code === 409).length, 1);
  const record = reports(f)[0];
  assert.equal(record.processing.adminId, 'root'); assert.equal(record.processing.adminName, '值班管理员');
  assert.equal(record.processing.remark, ' 原文\n核实 😀 ');
  assert.ok(Number.isFinite(Date.parse(record.processing.processedAt)));
  assert.deepEqual({ users: f.tables().users, products: f.tables().products }, before);
  const old = await f.report('submit', payload()); assert.deepEqual(old.data, saved.data);
  assert.equal((await f.report('submit', payload('submission_new2'))).code, 0);
  assert.equal(reports(f).length, 2);
  const frozen = structuredClone(record.processing);
  assert.equal((await f.admin('processReport', { reportId: id, result: 'unsubstantiated', remark: '试图改判' })).code, 409);
  assert.deepEqual(f.tables().reports[id].processing, frozen);
});

test('failed processing cannot partially update result or release pending guard', async () => {
  const f = await reportFixture();
  const saved = await f.report('submit', payload());
  f.state.failWrites = true;
  assert.equal((await f.admin('processReport', { reportId: saved.data.reportId, result: 'substantiated', remark: '核实' })).code, 500);
  assert.equal(reports(f)[0].status, 'pending'); assert.equal(reports(f)[0].processing, null);
  assert.equal(Object.values(f.tables().report_pending_guards)[0].reportId, saved.data.reportId);
  f.state.failWrites = false;
  f.state.beforeTransaction = () => { f.tables().admins.root.status = 'disabled'; };
  assert.equal((await f.admin('processReport', { reportId: saved.data.reportId, result: 'substantiated', remark: '核实' })).code, 40004);
  assert.equal(reports(f)[0].status, 'pending');
});

test('product inspection supports exact document or product ID while preserving existing list', async () => {
  const f = await reportFixture();
  for (const id of ['product', 'P1']) assert.equal((await f.admin('listProducts', { id })).data.list[0]._id, 'product');
  assert.equal((await f.admin('listProducts', { id: 'missing' })).data.total, 0);
  assert.equal((await f.admin('listProducts')).data.total, 1);
});

test('static JPEG/WebP metadata comes from actual images and malformed or animated bytes are rejected', async () => {
  const jpeg = await sharp({ create: { width: 3, height: 2, channels: 3, background: 'white' } }).jpeg().toBuffer();
  assert.deepEqual(imageInfo(jpeg), { format: 'jpg', width: 3, height: 2 });
  assert.equal(imageInfo(jpeg.subarray(0, -2)), null);
  const webp = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');
  assert.deepEqual(imageInfo(webp), { format: 'webp', width: 1, height: 1 });
  const animation = Buffer.alloc(8); animation.write('ANIM');
  const animated = Buffer.concat([webp, animation]); animated.writeUInt32LE(animated.length - 8, 4);
  assert.equal(imageInfo(animated), null);
  const damaged = Buffer.from(PNG); damaged[45] ^= 1;
  assert.equal(imageInfo(damaged), null);
});

test('real JPEG, PNG and WebP decode successfully, while plausible headers with forged pixels fail', async () => {
  for (const [encoder, extension] of [['jpeg', 'jpg'], ['png', 'png'], ['webp', 'webp']]) {
    const f = await reportFixture();
    const bytes = await sharp({ create: { width: 3, height: 2, channels: 3, background: 'blue' } })[encoder]().toBuffer();
    const image = await upload(f, payload().submissionId, 'image_0001', bytes, extension);
    assert.equal((await f.report('submit', payload(undefined, { attachments: [image] }))).code, 0);
    assert.equal(reports(f)[0].attachments[0].width, 3);
    assert.equal(reports(f)[0].attachments[0].height, 2);
    assert.deepEqual(f.state.files.get(reports(f)[0].attachments[0].fileId), bytes);
  }
  const malformedPng = Buffer.concat([PNG.subarray(0, 33), pngChunk('IDAT', Buffer.from('this is not compressed image pixels')), PNG.subarray(-12)]);
  assert.deepEqual(imageInfo(malformedPng), { format: 'png', width: 1, height: 1 });
  const malformedJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, 0, 2, 0, 3, 1, 1, 0x11, 0,
    0xff, 0xda, 0, 8, 1, 1, 0, 0, 63, 0, 0x32, 0x55, 0xff, 0xd9]);
  const malformedWebp = Buffer.alloc(30); malformedWebp.write('RIFF'); malformedWebp.writeUInt32LE(22, 4);
  malformedWebp.write('WEBPVP8 ', 8); malformedWebp.writeUInt32LE(10, 16);
  Buffer.from([0x9d, 1, 0x2a, 1, 0, 1, 0]).copy(malformedWebp, 23);
  for (const [bytes, extension] of [[malformedPng, 'png'], [malformedJpeg, 'jpg'], [malformedWebp, 'webp']]) {
    assert.ok(imageInfo(bytes), 'This case must reach the real decoder after passing structural metadata checks');
    const f = await reportFixture();
    const image = await upload(f, payload().submissionId, 'image_0001', bytes, extension);
    const result = await f.report('submit', payload(undefined, { attachments: [image] }));
    assert.equal(result.code, 400);
    assert.equal(result.message, '暂不支持该图片格式');
    assert.equal(result.data.settled, true);
    assert.equal(reports(f).length, 0);
  }
});

test('exactly 10 MiB and nine valid screenshots are accepted, and a copied-file failure commits nothing', async () => {
  const f = await reportFixture();
  const exact = paddedPng(MAX_IMAGE_BYTES);
  assert.equal(exact.length, MAX_IMAGE_BYTES);
  const files = [await upload(f, 'submission_boundary', 'image_0000', exact)];
  for (let i = 1; i < 9; i++) files.push(await upload(f, 'submission_boundary', `image_000${i}`));
  let copies = 0;
  const original = f.cloud.uploadFile;
  f.cloud.uploadFile = async args => { if (++copies === 2) throw new Error('storage unavailable'); return original(args); };
  const body = payload('submission_boundary', { attachments: files });
  assert.equal((await f.report('submit', body)).code, 500);
  assert.equal(reports(f).length, 0);
  assert.deepEqual((await f.report('getSubmissionResult', { submissionId: body.submissionId })).data, { submitted: false });
  f.cloud.uploadFile = original;
  const retried = await f.report('submit', body);
  assert.equal(retried.code, 0, retried.message);
  assert.equal(reports(f)[0].attachments.length, 9);
  assert.equal(reports(f)[0].attachments[0].size, MAX_IMAGE_BYTES);
});

test('changing uploaded bytes under the same submission and file IDs cannot overwrite a locked evidence body', async () => {
  const f = await reportFixture();
  const file = await upload(f);
  const original = f.cloud.uploadFile;
  f.cloud.uploadFile = async () => { throw new Error('copy unavailable'); };
  const body = payload(undefined, { attachments: [file] });
  assert.equal((await f.report('submit', body)).code, 500);
  f.cloud.uploadFile = original;
  f.state.files.set(file.fileId, paddedPng(PNG.length + 20));
  assert.equal((await f.report('submit', body)).code, 409);
  assert.equal(reports(f).length, 0);
  f.state.files.set(file.fileId, PNG);
  assert.equal((await f.report('submit', body)).code, 409);
});

test('a definitive retry rejection fences a slower original worker before it can commit', async () => {
  const f = await reportFixture();
  const file = await upload(f);
  const body = payload(undefined, { attachments: [file] });
  let signalCopy, releaseCopy;
  const copying = new Promise(resolve => { signalCopy = resolve; });
  const released = new Promise(resolve => { releaseCopy = resolve; });
  const originalUpload = f.cloud.uploadFile;
  f.cloud.uploadFile = async args => { signalCopy(); await released; return originalUpload(args); };
  const original = f.report('submit', body);
  await copying;
  f.state.files.delete(file.fileId);
  const retry = await f.report('submit', body);
  assert.equal(retry.code, 400);
  assert.equal(retry.message, '截图上传失败，请重试');
  assert.deepEqual(retry.data, { settled: true, rejected: true, submissionId: body.submissionId });
  releaseCopy();
  assert.equal((await original).code, 400);
  assert.equal(reports(f).length, 0);
  f.cloud.uploadFile = originalUpload;
  f.state.files.set(file.fileId, PNG);
  assert.equal((await f.report('submit', body)).code, 400);
  assert.equal((await f.report('submit', payload('submission_after_rejection'))).code, 0);
});

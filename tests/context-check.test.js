const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { Readable } = require('node:stream');
const { checkContext } = require('../scripts/check-context.cjs');

const threadId = '00000000-0000-0000-0000-000000000001';
const otherId = '00000000-0000-0000-0000-000000000002';
const recordedAt = '2026-09-08T02:00:00.000Z';
function usage(inputTokens, contextWindow = 1000) {
  return { type: 'event_msg', timestamp: recordedAt, payload: { type: 'token_count', info: {
    last_token_usage: { input_tokens: inputTokens, cached_input_tokens: inputTokens, output_tokens: 200 },
    total_token_usage: { input_tokens: 9000000 }, model_context_window: contextWindow,
  } } };
}
async function fixture(t, records = []) {
  const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), 'campusx-context-test-'));
  t.after(() => fs.rm(codexHome, { recursive: true, force: true }));
  const directory = path.join(codexHome, 'sessions', '2026', '09', '08');
  await fs.mkdir(directory, { recursive: true });
  const file = path.join(directory, `rollout-test-${threadId}.jsonl`);
  await fs.writeFile(file, records.map(item => JSON.stringify(item)).join('\n') + '\n');
  return { codexHome, file, directory, options: { codexHome, threadId } };
}

test('context statistics use the latest input, not cumulative usage or uncached input', async t => {
  const f = await fixture(t, [usage(900), usage(506)]);
  const before = await fs.readFile(f.file, 'utf8');
  const result = await checkContext(f.options);
  assert.equal(result.status, 'ok');
  assert.equal(result.inputTokens, 506);
  assert.equal(result.contextWindow, 1000);
  assert.equal(result.percent, 50.6);
  assert.equal(result.level, 'normal');
  assert.equal(result.recordedAt, recordedAt);
  assert.equal(await fs.readFile(f.file, 'utf8'), before);
  assert.deepEqual(await fs.readdir(f.codexHome), ['sessions']);
});

test('warning thresholds include 70 and 85 percent without capping overflows', async t => {
  const f = await fixture(t);
  for (const [tokens, level] of [[699, 'normal'], [700, 'warning'], [849, 'warning'], [850, 'high'], [1100, 'high']]) {
    await fs.writeFile(f.file, JSON.stringify(usage(tokens)));
    const result = await checkContext(f.options);
    assert.equal(result.level, level);
    assert.equal(result.percent, tokens / 10);
    assert.equal(result.notificationKey, `${threadId}:0:${level}`);
  }
});

test('only the named thread is read and chat content is not included in output', async t => {
  const f = await fixture(t, [{ type: 'response_item', payload: { role: 'user', content: 'private-text' } }, usage(100)]);
  await fs.writeFile(path.join(f.directory, `rollout-test-${otherId}.jsonl`), JSON.stringify(usage(950)));
  const result = await checkContext(f.options);
  assert.equal(result.inputTokens, 100);
  assert.equal(JSON.stringify(result).includes('private-text'), false);
  assert.equal((await checkContext({ ...f.options, threadId: '00000000-0000-0000-0000-000000000003' })).reason, 'session_not_found');
});

test('compaction invalidates old usage and resets the reminder key when new usage arrives', async t => {
  const f = await fixture(t, [usage(900), { type: 'compacted', timestamp: recordedAt }]);
  assert.equal((await checkContext(f.options)).reason, 'awaiting_post_compaction_usage');
  await fs.appendFile(f.file, JSON.stringify(usage(300)) + '\n');
  const result = await checkContext(f.options);
  assert.equal(result.level, 'normal');
  assert.equal(result.compactionCount, 1);
  assert.equal(result.lastCompactionAt, recordedAt);
  assert.equal(result.notificationKey, `${threadId}:1:normal`);
});

test('absent or invalid telemetry is unknown, never zero percent or an older safe reading', async t => {
  const f = await fixture(t);
  assert.equal((await checkContext(f.options)).reason, 'missing_usage');
  for (const record of [usage(null), usage('100'), usage(-1), usage(100, 0), usage(100, null), usage(1.5)]) {
    await fs.writeFile(f.file, JSON.stringify(usage(100)) + '\n' + JSON.stringify(record));
    const result = await checkContext(f.options);
    assert.equal(result.reason, 'invalid_usage');
    assert.equal(result.level, 'unknown');
    assert.equal(result.percent, undefined);
  }
});

test('partial log writes and empty token events do not break a valid snapshot', async t => {
  const f = await fixture(t, [null, usage(720), { type: 'event_msg', payload: { type: 'token_count', info: null } }]);
  await fs.appendFile(f.file, '{"type":"event_msg"');
  assert.equal((await checkContext(f.options)).level, 'warning');
});

test('missing identity, missing logs and duplicate session files return explicit unavailable states', async t => {
  const f = await fixture(t, [usage(720)]);
  assert.equal((await checkContext({ ...f.options, threadId: '' })).reason, 'missing_thread_id');
  assert.equal((await checkContext({ ...f.options, threadId: '../bad' })).reason, 'invalid_thread_id');
  assert.equal((await checkContext({ ...f.options, codexHome: path.join(f.codexHome, 'absent') })).reason, 'session_not_found');
  await fs.writeFile(path.join(f.directory, `rollout-copy-${threadId}.jsonl`), JSON.stringify(usage(100)));
  assert.equal((await checkContext(f.options)).reason, 'ambiguous_session');
});

test('a stream read error is reported without exposing its private error details', async t => {
  const f = await fixture(t, [usage(100)]);
  t.mock.method(require('node:fs'), 'createReadStream', () => new Readable({
    read() { this.destroy(Object.assign(new Error('private-file-details'), { code: 'EACCES' })); },
  }));
  const result = await checkContext(f.options);
  assert.equal(result.reason, 'read_failed');
  assert.equal(result.level, 'unknown');
  assert.equal(JSON.stringify(result).includes('private-file-details'), false);
});

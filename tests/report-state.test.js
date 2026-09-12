const test = require('node:test');
const assert = require('node:assert/strict');
const state = require('../miniprogram/utils/report-state');
const media = require('../miniprogram/utils/report-media');

function fixture(t) {
  const stored = new Map();
  global.wx = { getStorageSync: key => structuredClone(stored.get(key)), setStorageSync: (key, value) => stored.set(key, structuredClone(value)) };
  t.after(() => { delete global.wx; });
  return stored;
}
test('report drafts are separate from chat, accounts and sessions; stale writes cannot replace a newer draft', t => {
  const stored = fixture(t);
  stored.set('chat:v1:A:S1', { draft: '聊天草稿' });
  const original = state.read('A', 'S1');
  const stale = state.read('A', 'S1');
  Object.assign(original, { reasonCode: 'other', detail: '举报草稿', revision: state.newId() });
  assert.equal(state.write('A', 'S1', original), true);
  stale.detail = '过时页面';
  assert.equal(state.write('A', 'S1', stale), false);
  assert.equal(state.read('A', 'S1').detail, '举报草稿');
  assert.equal(state.read('B', 'S1').detail, '');
  assert.equal(state.read('A', 'S2').detail, '');
  assert.equal(stored.get('chat:v1:A:S1').draft, '聊天草稿');
});
test('success only clears the matching attempt and original draft revision', t => {
  fixture(t);
  const draft = { ...state.read('A', 'S1'), reasonCode: 'other', detail: '原材料', revision: 'revision-1', images: [{ imageId: 'I1', localPath: 'saved.png' }] };
  draft.attempt = state.createAttempt(draft);
  draft.attempt.phase = 'unknown';
  state.write('A', 'S1', draft);
  const original = structuredClone(draft.attempt);
  draft.detail = '另一份新草稿'; draft.revision = 'revision-2';
  state.write('A', 'S1', draft);
  assert.equal(state.clearSuccess('A', 'S1', original), null);
  assert.equal(state.read('A', 'S1').detail, '另一份新草稿');
  draft.revision = 'revision-1'; state.write('A', 'S1', draft);
  const cleared = state.clearSuccess('A', 'S1', original);
  assert.deepEqual(cleared.paths, ['saved.png']);
  assert.equal(state.read('A', 'S1').attempt, null);
  assert.equal(state.clearSuccess('A', 'S1', original), null);
});
test('validation counts Unicode code points and preserves spaces and newlines', () => {
  const draft = { reasonCode: 'other', detail: ' 😀\n', images: [] };
  assert.equal(state.formError(draft), '');
  assert.equal(state.formError({ ...draft, detail: ' \n\t' }), '请输入详细信息');
  assert.equal(state.formError({ ...draft, detail: '😀'.repeat(100) }), '');
  assert.equal(state.formError({ ...draft, detail: '😀'.repeat(101) }), '详细信息最多输入100字');
  assert.equal(state.formError({ ...draft, reasonCode: 'bad', detail: '' }), '请选择举报原因');
  const attempt = state.createAttempt(draft);
  const body = state.requestBody('S1', attempt);
  assert.equal(body.detail, ' 😀\n');
  draft.detail = 'changed';
  assert.equal(state.requestBody('S1', attempt).detail, ' 😀\n');
});
function chunk(type, bytes = Buffer.alloc(0)) {
  const value = Buffer.alloc(bytes.length + 12); value.writeUInt32BE(bytes.length); value.write(type, 4); bytes.copy(value, 8); return value;
}
function arrayBuffer(value) { return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength); }
test('client detects static PNG/WebP/JPEG bytes and rejects animation, disguised extensions and truncated chunks', () => {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const png = Buffer.concat([signature, chunk('IHDR', Buffer.alloc(13)), chunk('IDAT', Buffer.from([1])), chunk('IEND')]);
  assert.equal(media.imageFormat(arrayBuffer(png)), 'png');
  assert.equal(media.imageFormat(arrayBuffer(Buffer.concat([signature, chunk('IHDR', Buffer.alloc(13)), chunk('acTL'), chunk('IDAT'), chunk('IEND')]))), '');
  assert.equal(media.imageFormat(arrayBuffer(png.subarray(0, png.length - 1))), '');
  assert.equal(media.imageFormat(arrayBuffer(Buffer.from('GIF89a-not-a-static-image'))), '');
  const jpeg = Buffer.from([255, 216, 255, 1, 2, 3, 4, 5, 6, 7, 255, 217]);
  assert.equal(media.imageFormat(arrayBuffer(jpeg)), 'jpg');
  const webp = Buffer.alloc(22); webp.write('RIFF'); webp.writeUInt32LE(14, 4); webp.write('WEBPVP8 ', 8); webp.writeUInt32LE(2, 16);
  assert.equal(media.imageFormat(arrayBuffer(webp)), 'webp');
  webp.write('ANIM', 12);
  assert.equal(media.imageFormat(arrayBuffer(webp)), '');
});

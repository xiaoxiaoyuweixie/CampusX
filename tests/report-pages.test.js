const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { api } = require('../miniprogram/api');
const state = require('../miniprogram/utils/report-state');
const media = require('../miniprogram/utils/report-media');
const defaults = { ...api };
const ok = data => ({ result: { code: 0, data } });
const error = (code, message, data) => ({ result: { code, message, data } });
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function imageBytes(size = 12) { const bytes = new Uint8Array(size); bytes.set([255, 216, 255]); bytes.set([255, 217], size - 2); return bytes.buffer; }
function fixture(t, initial = []) {
  Object.assign(api, defaults);
  const stored = new Map([['userInfo', { logged: true, openid: 'A' }], ...initial]);
  const files = new Map(), notices = [], navigations = [], uploads = [], removed = [], previews = [], timers = [];
  const pages = [];
  global.wx = {
    getStorageSync: key => structuredClone(stored.get(key)),
    setStorageSync: (key, value) => stored.set(key, structuredClone(value)),
    showToast: value => notices.push(value), redirectTo: value => navigations.push({ ...value, type: 'redirect' }),
    navigateTo: value => { navigations.push({ ...value, type: 'to' }); if (value.complete) value.complete(); },
    navigateBack: value => navigations.push({ ...value, type: 'back' }),
    showActionSheet: async () => ({ tapIndex: 1 }),
    chooseMedia: async () => ({ tempFiles: [] }),
    getImageInfo: async () => ({ type: 'jpeg', width: 10, height: 20 }),
    previewImage: async value => previews.push(value),
    cloud: { uploadFile: async value => { uploads.push(value); return { fileID: `cloud://test/${value.cloudPath}` }; } },
    getFileSystemManager: () => ({
      stat: ({ path, success, fail }) => files.has(path) ? success({ stats: { size: files.get(path).byteLength } }) : fail(new Error('missing')),
      readFile: ({ filePath, success, fail }) => files.has(filePath) ? success({ data: files.get(filePath) }) : fail(new Error('missing')),
      saveFile: ({ tempFilePath, success }) => { const savedFilePath = `saved:${tempFilePath}`; files.set(savedFilePath, files.get(tempFilePath)); success({ savedFilePath }); },
      removeSavedFile: ({ filePath }) => { removed.push(filePath); files.delete(filePath); },
    }),
  };
  global.getCurrentPages = () => [{ route: 'pages/chat/index', sessionId: 'S1' }, pages[pages.length - 1]];
  t.mock.method(global, 'setTimeout', (callback, delay) => { const timer = { callback, delay }; timers.push(timer); return timer; });
  t.mock.method(global, 'clearTimeout', timer => { if (timer) timer.cancelled = true; });
  api.getReportContext = async () => ok({ sessionId: 'S1', product: { productId: 'P1', title: '测试商品' }, peer: { openid: 'B', nickname: '对方' } });
  api.getReportSubmissionResult = async () => ok({ submitted: false });
  api.prepareReportEvidence = async data => ok({ cloudPath: `${data.submissionId}/${data.imageId}.${data.extension}` });
  api.submitReport = async data => ok({ submitted: true, reportId: 'R1', submissionId: data.submissionId });
  function create(sessionId = 'S1') {
    let definition; global.Page = value => { definition = value; };
    const file = require.resolve('../miniprogram/pages/report/index.js'); delete require.cache[file]; require(file);
    const page = { ...definition, data: structuredClone(definition.data), setData(update) { Object.assign(this.data, update); } };
    pages.push(page); page.onLoad({ sessionId }); page.onShow(); return page;
  }
  function select(paths) { paths.forEach(path => files.set(path, imageBytes())); global.wx.chooseMedia = async () => ({ tempFiles: paths.map(tempFilePath => ({ tempFilePath })) }); }
  t.after(() => { pages.forEach(page => page.onUnload()); Object.assign(api, defaults); delete global.wx; delete global.Page; delete global.getCurrentPages; });
  return { stored, files, notices, navigations, uploads, removed, previews, timers, create, select };
}
function fill(page, detail = '举报详情') { page.onReason({ currentTarget: { dataset: { code: 'other' } } }); page.onDetailInput({ detail: { value: detail } }); }

test('seven reasons are single-select; empty form remains submittable for validation and Unicode content is not truncated', async t => {
  const f = fixture(t); const page = f.create(); await page.ready;
  assert.equal(page.data.reasons.length, 7);
  await page.onSubmit(); assert.equal(f.notices.at(-1).title, '请选择举报原因');
  for (const reason of page.data.reasons) { page.onReason({ currentTarget: { dataset: { code: reason.code } } }); assert.equal(page.data.reasonCode, reason.code); }
  await page.onSubmit(); assert.equal(f.notices.at(-1).title, '请输入详细信息');
  fill(page, '😀'.repeat(101)); assert.equal(page.data.count, 101); await page.onSubmit();
  assert.equal(f.notices.at(-1).title, '详细信息最多输入100字');
  let body; api.submitReport = async data => { body = data; return ok({ submitted: true, reportId: 'R1', submissionId: data.submissionId }); };
  fill(page, '  描述😀\n'); await page.onSubmit();
  assert.equal(body.detail, '  描述😀\n'); assert.equal(body.attachments.length, 0);
  assert.equal(f.notices.at(-1).duration, 2000); assert.equal(f.timers.at(-1).delay, 2000);
  f.timers.at(-1).callback(); assert.equal(f.navigations.at(-1).type, 'back');
});
test('double taps dispatch once and success clears only report state and local report copies', async t => {
  const f = fixture(t, [['chat:v1:A:S1', { draft: '聊天草稿' }]]); const page = f.create(); await page.ready;
  fill(page); f.select(['one']); await page.onChooseImages();
  const pending = deferred(); let count = 0, body;
  api.submitReport = data => { count += 1; body = data; return pending.promise; };
  const first = page.onSubmit(); const second = page.onSubmit(); await tick();
  assert.equal(count, 1); assert.equal(page.data.busy, true);
  page.onDetailInput({ detail: { value: '不允许覆盖' } }); assert.equal(page.data.detail, '举报详情');
  pending.resolve(ok({ submitted: true, reportId: 'R1', submissionId: body.submissionId })); await first; await second;
  assert.equal(state.read('A', 'S1').detail, ''); assert.equal(f.stored.get('chat:v1:A:S1').draft, '聊天草稿');
  assert.deepEqual(f.removed, ['saved:one']);
});
test('failed image upload blocks the whole report; retry keeps previously uploaded file identity and ordered attachments', async t => {
  const f = fixture(t); const page = f.create(); await page.ready; fill(page); f.select(['one', 'two']); await page.onChooseImages();
  let fail = true, submissions = 0, body;
  global.wx.cloud.uploadFile = async value => { f.uploads.push(value); if (value.filePath === 'saved:two' && fail) throw new Error('offline'); return { fileID: `cloud://test/${value.cloudPath}` }; };
  api.submitReport = async data => { submissions += 1; body = data; return ok({ submitted: true, reportId: 'R1', submissionId: data.submissionId }); };
  await page.onSubmit(); assert.equal(submissions, 0); assert.equal(page.data.locked, false);
  assert.equal(f.notices.at(-1).title, '截图上传失败，请重试');
  const id = page.state.attempt.submissionId, firstFileId = page.state.attempt.images[0].fileId;
  fail = false; await page.onSubmit();
  assert.equal(submissions, 1); assert.equal(body.submissionId, id); assert.equal(body.attachments[0].fileId, firstFileId);
  assert.deepEqual(f.uploads.map(item => item.filePath), ['saved:one', 'saved:two', 'saved:two']);
});
test('unknown results freeze the original payload and replay without changing image ids or file ids', async t => {
  const f = fixture(t); const page = f.create(); await page.ready; fill(page); f.select(['one']); await page.onChooseImages();
  const bodies = []; api.submitReport = async data => { bodies.push(structuredClone(data)); throw new Error('lost response'); };
  await page.onSubmit(); assert.equal(page.data.unknown, true); assert.equal(page.data.locked, true);
  page.onDetailInput({ detail: { value: 'new' } }); assert.equal(page.data.detail, '举报详情');
  f.files.delete('saved:one');
  api.submitReport = async data => { bodies.push(structuredClone(data)); return ok({ submitted: true, reportId: 'R1', submissionId: data.submissionId }); };
  await page.onSubmit(); assert.deepEqual(bodies[1], bodies[0]); assert.equal(f.uploads.length, 1);
});
test('reentry resolves the receipt before a now-deleted conversation, product or peer can block it', async t => {
  const f = fixture(t); const first = f.create(); await first.ready; fill(first);
  api.submitReport = async () => { throw new Error('lost response'); }; await first.onSubmit(); first.onHide();
  let contexts = 0;
  api.getReportContext = async () => { contexts += 1; return error(404, '举报对象不存在或已被删除，无法提交举报'); };
  const id = first.state.attempt.submissionId;
  api.getReportSubmissionResult = async () => ok({ submitted: true, reportId: 'R1', submissionId: id });
  const second = f.create(); await second.ready;
  assert.equal(contexts, 0); assert.equal(second.data.succeeded, true); assert.equal(state.read('A', 'S1').attempt, null);
});
test('receipt lookup failure does not unlock or replace an unknown submission', async t => {
  const f = fixture(t); const page = f.create(); await page.ready; fill(page);
  api.submitReport = async () => error(500, '服务异常'); await page.onSubmit();
  const id = page.state.attempt.submissionId;
  api.getReportSubmissionResult = async () => error(403, '无权访问'); await page.onSubmit();
  assert.equal(page.state.attempt.submissionId, id); assert.equal(page.data.locked, true);
});
test('an unmarked submit 403 keeps an unknown attempt recoverable after the account is enabled again', async t => {
  const f = fixture(t); const page = f.create(); await page.ready; fill(page);
  api.submitReport = async () => { throw new Error('original response lost'); }; await page.onSubmit();
  const original = state.requestBody('S1', page.state.attempt);
  api.submitReport = async data => { assert.deepEqual(data, original); return error(403, '账号已被禁用'); };
  await page.onSubmit();
  assert.equal(page.state.attempt.submissionId, original.submissionId); assert.equal(page.data.locked, true);
  assert.equal(f.notices.at(-1).title, '账号已被禁用');
  api.getReportSubmissionResult = async () => ok({ submitted: true, reportId: 'R1', submissionId: original.submissionId });
  await page.onSubmit();
  assert.equal(page.data.succeeded, true); assert.equal(state.read('A', 'S1').attempt, null);
});
test('a rejection settlement for another submission does not unlock the original unknown material', async t => {
  const f = fixture(t); const page = f.create(); await page.ready; fill(page);
  api.submitReport = async () => error(404, '举报对象不存在', { settled: true, rejected: true, submissionId: 'different-id' });
  await page.onSubmit();
  assert.equal(page.data.unknown, true); assert.equal(page.data.locked, true);
  page.onDetailInput({ detail: { value: 'must not replace' } }); assert.equal(page.data.detail, '举报详情');
});
test('explicit pending rejection preserves draft and allows a new corrected logical attempt', async t => {
  const f = fixture(t); const page = f.create(); await page.ready; fill(page);
  let first;
  api.submitReport = async data => { first = data.submissionId; return error(409, '该会话已有待处理举报，请勿重复提交',
    { settled: true, rejected: true, submissionId: data.submissionId }); };
  await page.onSubmit(); assert.equal(page.state.attempt, null); assert.equal(page.data.detail, '举报详情'); assert.equal(page.data.locked, false);
  fill(page, '修正后的说明'); let second;
  api.submitReport = async data => { second = data.submissionId; return ok({ submitted: true, reportId: 'R2', submissionId: data.submissionId }); };
  await page.onSubmit(); assert.notEqual(second, first);
});
test('late success after leaving or changing account cannot navigate, reveal content or clear another draft', async t => {
  const f = fixture(t); const page = f.create(); await page.ready; fill(page);
  const pending = deferred(); let body;
  api.submitReport = data => { body = data; return pending.promise; };
  const task = page.onSubmit(); await tick(); page.onHide();
  f.stored.set('userInfo', { logged: true, openid: 'B' });
  pending.resolve(ok({ submitted: true, reportId: 'R1', submissionId: body.submissionId })); await task;
  assert.equal(f.notices.some(item => item.title === '提交成功'), false);
  assert.equal(f.navigations.length, 0); assert.equal(state.read('A', 'S1').attempt.phase, 'unknown');
  assert.equal(state.read('B', 'S1').detail, '');
  page.onShow(); assert.equal(page.data.detail, ''); assert.equal(f.navigations.at(-1).url, '/pages/login/index');
});
test('a newer draft prevents old success cleanup and the delayed return cannot hijack a changed page', async t => {
  const f = fixture(t); const page = f.create(); await page.ready; fill(page);
  const pending = deferred(); let body;
  api.submitReport = data => { body = data; return pending.promise; };
  const task = page.onSubmit(); await tick();
  const newer = state.read('A', 'S1'); newer.revision = state.newId(); newer.detail = 'new draft'; state.write('A', 'S1', newer);
  pending.resolve(ok({ submitted: true, reportId: 'R1', submissionId: body.submissionId })); await task;
  assert.equal(state.read('A', 'S1').detail, 'new draft'); assert.equal(f.timers.length, 0);
});
test('drafts restore by owner and session, missing files stay visible and cancel leaves all material unchanged', async t => {
  const f = fixture(t); const page = f.create(); await page.ready; fill(page); f.select(['one', 'two']); await page.onChooseImages();
  await page.onPreviewImage({ currentTarget: { dataset: { id: page.state.images[0].imageId } } });
  assert.deepEqual(f.previews[0].urls, ['saved:one', 'saved:two']);
  const before = structuredClone(page.state); global.wx.showActionSheet = async () => { throw { errMsg: 'showActionSheet:fail cancel' }; };
  await page.onChooseImages(); assert.deepEqual(page.state, before);
  page.onHide(); f.files.delete('saved:two'); const restored = f.create(); await restored.ready;
  assert.equal(restored.data.detail, '举报详情'); assert.deepEqual(restored.data.images.map(item => item.missing), [false, true]);
  await restored.onSubmit(); assert.equal(f.notices.at(-1).title, '部分截图已失效，请重新选择');
  restored.onRemoveImage({ currentTarget: { dataset: { id: restored.state.images[1].imageId } } });
  assert.equal(restored.state.images.length, 1);
  const otherSession = f.create('S2'); await otherSession.ready; assert.equal(otherSession.data.detail, '');
});
test('nine is a total limit, chooser uses remaining capacity and invalid selection batches are not partially accepted', async t => {
  const f = fixture(t); const page = f.create(); await page.ready;
  f.select(Array.from({ length: 8 }, (_, i) => String(i))); await page.onChooseImages();
  let count; f.files.set('ninth', imageBytes());
  global.wx.chooseMedia = async data => { count = data.count; return { tempFiles: [{ tempFilePath: 'ninth' }] }; };
  await page.onChooseImages(); assert.equal(count, 1); assert.equal(page.data.images.length, 9);
  await page.onChooseImages(); assert.equal(f.notices.at(-1).title, '最多上传9张截图');
  page.onRemoveImage({ currentTarget: { dataset: { id: page.state.images[0].imageId } } });
  global.wx.chooseMedia = async () => ({ tempFiles: [{ tempFilePath: 'one' }, { tempFilePath: 'two' }] });
  await page.onChooseImages(); assert.equal(page.data.images.length, 8);
  assert.equal(f.notices.at(-1).title, '最多上传9张截图');
});
test('10 MiB is accepted; one extra byte and disguised image bytes are rejected before upload', async t => {
  const f = fixture(t);
  f.files.set('exact', imageBytes(media.MAX_IMAGE_BYTES));
  assert.equal((await media.inspect('exact')).size, media.MAX_IMAGE_BYTES);
  f.files.set('too-big', imageBytes(media.MAX_IMAGE_BYTES + 1));
  await assert.rejects(media.inspect('too-big'), /单张图片不能超过10MB/);
  f.files.set('fake.png', new Uint8Array(20).buffer);
  await assert.rejects(media.inspect('fake.png'), /暂不支持该图片格式/);
  assert.equal(f.uploads.length, 0);
});
test('native image selection survives onHide and a completion callback before onShow', async t => {
  const f = fixture(t); const page = f.create(); await page.ready; fill(page);
  f.files.set('camera', imageBytes());
  const pending = deferred(); global.wx.chooseMedia = () => pending.promise;
  const choosing = page.onChooseImages(); await tick(); page.onHide();
  pending.resolve({ tempFiles: [{ tempFilePath: 'camera' }] }); await choosing;
  assert.equal(state.read('A', 'S1').images[0].localPath, 'saved:camera');
  page.onShow(); await page.ready;
  assert.equal(page.data.images.length, 1); assert.equal(page.data.detail, '举报详情');
  assert.equal(page.data.loading, false); assert.equal(page.data.picking, false);
});
test('native selection result is discarded after the report page has actually been left', async t => {
  const f = fixture(t); const page = f.create(); await page.ready; f.files.set('camera', imageBytes());
  const pending = deferred(); global.wx.chooseMedia = () => pending.promise;
  const choosing = page.onChooseImages(); await tick(); page.onHide();
  global.getCurrentPages = () => [{ route: 'pages/chat/index', sessionId: 'S1' }];
  pending.resolve({ tempFiles: [{ tempFilePath: 'camera' }] }); await choosing;
  assert.equal(state.read('A', 'S1').images.length, 0);
});
test('chat report entry is independent of sending permission and page registration resolves', async t => {
  const f = fixture(t);
  let definition; global.Page = value => { definition = value; };
  const path = require.resolve('../miniprogram/pages/chat/index.js'); delete require.cache[path]; require(path);
  const page = { ...definition, owner: 'A', sessionId: 'empty/off-sale', data: { permissions: { canSend: false } } };
  page.onReport(); assert.equal(f.navigations.at(-1).url, '/pages/report/index?sessionId=empty%2Foff-sale');
  const app = JSON.parse(fs.readFileSync(require.resolve('../miniprogram/app.json'), 'utf8'));
  assert.equal(app.pages.filter(path => path === 'pages/report/index').length, 1);
});

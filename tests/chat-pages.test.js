const test = require('node:test');
const assert = require('node:assert/strict');
const { api } = require('../miniprogram/api');
const defaults = { ...api };
const tick = () => new Promise(resolve => setImmediate(resolve));
const ok = data => ({ result: { code: 0, data } });
const state = () => ({ canSend: true, sendReason: '', wechat: { available: true, masked: 'ab****f', reason: '' }, phone: { available: true, reason: '' } });
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

function pageFixture(t, name = 'chat', stored = []) {
  Object.assign(api, defaults);
  const storage = new Map([['userInfo', { logged: true, openid: 'buyer' }], ...stored]);
  const notices = [], copies = [], calls = [];
  let definition;
  global.Page = value => { definition = value; };
  global.wx = {
    getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, structuredClone(value)),
    showToast: value => notices.push(value.title), setNavigationBarTitle() {}, redirectTo() {},
    setClipboardData: async value => { copies.push(value.data); }, makePhoneCall: async value => { calls.push(value.phoneNumber); },
    getFileSystemManager: () => ({
      stat: ({ success }) => success({ stats: { size: 100 } }),
      saveFile: ({ tempFilePath, success }) => success({ savedFilePath: tempFilePath }), removeSavedFile() {},
    }),
    getImageInfo: async () => ({ type: 'png', width: 10, height: 10 }),
    cloud: { uploadFile: async value => ({ fileID: `cloud://test/${value.filePath}` }) },
  };
  const file = require.resolve(`../miniprogram/pages/${name}/index.js`);
  delete require.cache[file]; require(file);
  const page = { ...definition, data: structuredClone(definition.data),
    setData(updates) {
      for (const [key, value] of Object.entries(updates)) {
        const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.');
        let target = this.data;
        for (const part of parts.slice(0, -1)) target = target[part] || (target[part] = {});
        target[parts[parts.length - 1]] = value;
      }
    },
  };
  api.getChatState = async () => ok(state());
  api.getMessages = async () => ok({ list: [], total: 0, session: { name: '对方' }, permissions: state() });
  page.onLoad({ sessionId: 'S1' });
  t.after(() => { page.onUnload(); Object.assign(api, defaults); delete global.wx; delete global.Page; });
  return { page, notices, copies, calls, storage };
}
const sent = data => ok({ message: { id: `M-${data.clientMessageId}`, clientMessageId: data.clientMessageId,
  type: data.type, text: data.content, status: 'sent', from: 'me', createdTimestamp: data.createdTimestamp,
  image: data.type === 'image' ? { width: 10, height: 10, url: 'https://test.invalid/image' } : null } });

test('repeated keyboard confirmation submits once and late success preserves a newer draft', async t => {
  const { page } = pageFixture(t);
  const pending = deferred(); let count = 0; let submitted;
  api.sendMessage = data => { count += 1; submitted = data; return pending.promise; };
  page.onInput({ detail: { value: 'old' } });
  const first = page.onSend(); const second = page.onSend();
  await tick(); assert.equal(count, 1);
  page.onInput({ detail: { value: 'new' } });
  pending.resolve(sent(submitted)); await first; await second; await tick();
  assert.equal(page.data.input, 'new'); assert.equal(page.outbox.length, 0);
});

test('failed text is retained and manually retried with the same submission identity', async t => {
  const { page } = pageFixture(t); const ids = [], timestamps = [];
  api.sendMessage = async data => { ids.push(data.clientMessageId); timestamps.push(data.createdTimestamp); throw new Error('lost response'); };
  page.onInput({ detail: { value: 'draft' } }); await page.onSend();
  assert.equal(page.data.input, 'draft'); assert.equal(page.outbox[0].status, 'failed');
  const firstLabel = page.data.messages[0].timeLabel;
  api.sendMessage = async data => { ids.push(data.clientMessageId); timestamps.push(data.createdTimestamp); return sent(data); };
  await page.onSend(); await tick();
  assert.equal(new Set(ids).size, 1); assert.equal(page.data.input, ''); assert.equal(page.outbox.length, 0);
  assert.equal(new Set(timestamps).size, 1);
  assert.equal(page.data.messages[0].timeLabel, firstLabel);
});

test('copy uses current value only as clipboard input and does not report failure as success', async t => {
  const { page, copies, notices } = pageFixture(t);
  api.getChatContact = async data => ok(data.purpose === 'preview' ? { masked: 'ol****d' } : { value: 'new-secret', masked: 'ne****t' });
  await page.onWechat(); await page.onCopyWechat();
  assert.deepEqual(copies, ['new-secret']); assert.equal(page.data.maskedWechat, 'ne****t');
  assert.equal(JSON.stringify(page.data).includes('new-secret'), false);
  notices.length = 0;
  global.wx.setClipboardData = async () => { throw new Error('clipboard denied'); };
  await page.onCopyWechat(); assert.deepEqual(notices, ['复制失败，请重试']);
  api.getChatContact = async () => ({ result: { code: 40003, message: '对方暂未开放微信联系方式' } });
  await page.onCopyWechat(); assert.equal(page.data.maskedWechat, '');
});

test('native cancellation does not create messages, report errors or clear drafts', async t => {
  const { page, notices } = pageFixture(t);
  page.onInput({ detail: { value: 'preserve' } });
  api.getChatContact = async () => ok({ value: '00123' });
  global.wx.makePhoneCall = async () => { throw { errMsg: 'makePhoneCall:fail cancel' }; };
  await page.onPhone();
  global.wx.showActionSheet = async () => { throw { errMsg: 'showActionSheet:fail cancel' }; };
  await page.onChooseImages();
  assert.equal(page.data.input, 'preserve'); assert.equal(page.outbox.length, 0); assert.deepEqual(notices, []);
});

test('multi-image partial failure does not block others; retry is individual and keeps draft/order', async t => {
  const { page } = pageFixture(t); let failSecond = true;
  global.wx.showActionSheet = async () => ({ tapIndex: 1 });
  global.wx.chooseMedia = async () => ({ tempFiles: ['one', 'two', 'three'].map(tempFilePath => ({ tempFilePath })) });
  global.wx.cloud.uploadFile = async ({ filePath }) => {
    if (filePath === 'two' && failSecond) throw new Error('network');
    return { fileID: `cloud://test/${filePath}` };
  };
  api.prepareChatImage = async () => ok({ cloudPath: 'stage' });
  const sentIds = [];
  api.sendMessage = async data => { sentIds.push(data.clientMessageId); return sent(data); };
  page.onInput({ detail: { value: 'text draft' } }); await page.onChooseImages(); await tick();
  assert.equal(page.data.input, 'text draft'); assert.equal(page.outbox.length, 1);
  assert.equal(page.outbox[0].image.localPath, 'two'); assert.equal(page.outbox[0].status, 'failed');
  const order = page.data.messages.map(item => item.clientMessageId);
  const times = page.data.messages.map(item => [item.createdTimestamp, item.timeLabel]);
  failSecond = false; await page.submit(page.outbox[0]); await tick();
  assert.equal(new Set(sentIds).size, 3); assert.equal(sentIds.length, 3);
  assert.deepEqual(page.data.messages.map(item => item.clientMessageId), order);
  assert.deepEqual(page.data.messages.map(item => [item.createdTimestamp, item.timeLabel]), times);
  assert.equal(page.data.input, 'text draft');
});

test('permission change while in the album prevents upload on return and retains text', async t => {
  const { page } = pageFixture(t); let checks = 0, uploads = 0;
  api.getChatState = async () => { checks += 1; return ok(checks === 1 ? state() : { ...state(), canSend: false, sendReason: '当前无法与该用户联系' }); };
  global.wx.showActionSheet = async () => ({ tapIndex: 1 });
  global.wx.chooseMedia = async () => ({ tempFiles: [{ tempFilePath: 'one' }] });
  global.wx.cloud.uploadFile = async () => { uploads += 1; };
  page.onInput({ detail: { value: 'draft' } }); await page.onChooseImages();
  assert.equal(uploads, 0); assert.equal(page.data.input, 'draft'); assert.equal(page.data.permissions.canSend, false);
});

test('contact load failure does not fake empty settings or permit mutation', async t => {
  const { page } = pageFixture(t, 'contacts'); let writes = 0;
  api.getContacts = async () => { throw new Error('network'); };
  api.setContactEnabled = async () => { writes += 1; };
  await page.loadContacts(); await page.onToggle({ currentTarget: { dataset: { type: 'wechat' } }, detail: { value: true } });
  assert.equal(page.data.contacts, null); assert.equal(page.data.loadFailed, true); assert.equal(writes, 0);
});

test('contact response loss keeps edit draft and reloads actual committed state', async t => {
  const { page, notices } = pageFixture(t, 'contacts');
  let server = { wechat: { value: 'old', enabled: true }, phone: { value: '', enabled: false } };
  api.getContacts = async () => ok(structuredClone(server)); await page.loadContacts();
  page.onEdit({ currentTarget: { dataset: { type: 'wechat' } } });
  page.onEditInput({ detail: { value: 'new' } });
  api.saveContact = async () => { server.wechat.value = 'new'; throw new Error('response lost'); };
  await page.onSave(); await tick();
  assert.equal(page.data.editingType, 'wechat'); assert.equal(page.data.editValue, 'new');
  assert.equal(page.data.contacts.wechat.value, 'new'); assert.equal(notices.includes('已保存'), false);
});

test('image bubbles fit portrait, landscape and square images without changing messages', t => {
  const { page } = pageFixture(t);
  page.remote = [
    { id: 'portrait', type: 'image', from: 'other', image: { width: 900, height: 1600 } },
    { id: 'landscape', type: 'image', from: 'me', image: { width: 1600, height: 900 } },
    { id: 'square', type: 'image', from: 'other', image: { width: 600, height: 600 } },
    { id: 'missing', type: 'image', from: 'other', image: {} },
  ].map((item, index) => ({ ...item, status: 'sent', createdTimestamp: index }));
  page.outbox = [{ id: 'local', clientMessageId: 'local', type: 'image', from: 'me', status: 'failed',
    image: { width: 1200, height: 2400, localPath: 'local.png' }, createdTimestamp: 4 }];
  page.renderMessages();
  assert.deepEqual(page.data.messages.map(item => item.imageStyle), [
    'width: 191.25rpx; height: 340rpx;', 'width: 340rpx; height: 191.25rpx;',
    'width: 340rpx; height: 340rpx;', 'width: 340rpx; height: 340rpx;',
    'width: 170rpx; height: 340rpx;',
  ]);
  assert.equal(page.remote[0].imageStyle, undefined);
  assert.equal(page.outbox[0].imageStyle, undefined);
});

test('decoded image proportions survive polling and local-to-sent message replacement', t => {
  const { page } = pageFixture(t);
  page.outbox = [{ id: 'local', clientMessageId: 'image-layout', type: 'image', from: 'me', status: 'sending',
    image: { width: 1, height: 1, localPath: 'local.png' }, createdTimestamp: 1 }];
  page.renderMessages();
  page.onImageLoad({ currentTarget: { dataset: { id: 'local' } }, detail: { width: 1200, height: 2400 } });
  assert.equal(page.data.messages[0].imageStyle, 'width: 170rpx; height: 340rpx;');
  page.acknowledge({ ...page.outbox[0], id: 'server', status: 'sent', image: { width: 1, height: 1, url: 'https://test.invalid/image' } });
  page.renderMessages();
  assert.equal(page.data.messages[0].id, 'server');
  assert.equal(page.data.messages[0].imageStyle, 'width: 170rpx; height: 340rpx;');
  page.onImageLoad({ currentTarget: { dataset: { id: 'server' } }, detail: { width: 0, height: 0 } });
  page.onImageLoad({ currentTarget: { dataset: { id: 'gone' } }, detail: { width: 100, height: 100 } });
  page.renderMessages();
  assert.equal(page.data.messages[0].imageStyle, 'width: 170rpx; height: 340rpx;');
});

const messageAt = (id, time, extra = {}) => ({ id, type: 'text', text: id, from: 'other', status: 'sent',
  createdTimestamp: Date.parse(`2026-09-05T${time}+08:00`), ...extra });

test('returning refreshes the self avatar even when loading fails; polling refreshes the peer for loaded history', async t => {
  const { page, storage } = pageFixture(t);
  storage.set('userInfo', { logged: true, openid: 'buyer', nickname: '小买', avatar: 'https://test.invalid/self-old' });
  const history = [messageAt('mine', '11:31:00', { from: 'me' }), messageAt('peer', '11:32:00', {
    type: 'image', image: { url: 'https://test.invalid/photo', width: 10, height: 20 },
  })];
  let session = { name: '小卖', avatar: 'https://test.invalid/peer-old' };
  api.getMessages = async () => ok({ list: history, total: 2, session, permissions: state() });
  page.onShow(); await tick();
  assert.deepEqual(page.data.avatars, { me: { url: 'https://test.invalid/self-old', initial: '小' },
    other: { url: 'https://test.invalid/peer-old', initial: '小' } });
  page.onHide();
  storage.set('userInfo', { logged: true, openid: 'buyer', nickname: '新买家', avatar: 'https://test.invalid/self-new' });
  api.getMessages = async () => { throw new Error('offline'); };
  page.onShow();
  assert.deepEqual(page.data.avatars.me, { url: 'https://test.invalid/self-new', initial: '新' });
  await tick(); page.stopPolling();
  assert.equal(page.data.loadFailed, true);
  assert.equal(page.data.avatars.other.url, 'https://test.invalid/peer-old');
  session = { name: '更新卖家', avatar: 'https://test.invalid/peer-new' };
  api.getMessages = async () => ok({ list: [messageAt('new-peer', '11:33:00')], total: 3, session, permissions: state() });
  await page.loadMessages();
  assert.deepEqual(page.data.avatars.other, { url: 'https://test.invalid/peer-new', initial: '更' });
  assert.deepEqual(page.data.messages.map(item => item.id), ['mine', 'peer', 'new-peer']);
});

test('avatar errors fall back per sender and recover on address changes without accepting stale errors', async t => {
  const { page, storage } = pageFixture(t);
  const systemAvatar = 'cloud://test/system/default-avatar.png';
  storage.set('userInfo', { logged: true, openid: 'buyer', nickname: '买家', avatar: systemAvatar });
  page.setData({ session: { name: '卖家', avatar: 'https://test.invalid/broken' } });
  page.renderMessages();
  assert.equal(page.data.avatars.me.url, systemAvatar);
  page.onAvatarError({ currentTarget: { dataset: { from: 'other', url: 'https://test.invalid/broken' } } });
  assert.deepEqual(page.data.avatars.other, { url: '', initial: '卖' });
  assert.equal(page.data.avatars.me.url, systemAvatar);
  page.renderMessages();
  assert.equal(page.data.avatars.other.url, '');
  page.onAvatarError({ currentTarget: { dataset: { from: 'me', url: systemAvatar } } });
  assert.deepEqual(page.data.avatars.me, { url: '', initial: '买' });
  storage.set('userInfo', { logged: true, openid: 'buyer', nickname: '', avatar: '' });
  page.setData({ session: { name: '', avatar: '' } });
  page.renderMessages();
  assert.deepEqual(page.data.avatars, { me: { url: '', initial: '校' }, other: { url: '', initial: '校' } });
  storage.set('userInfo', { logged: true, openid: 'buyer', nickname: '新买家', avatar: 'https://test.invalid/self-new' });
  page.setData({ session: { name: '新卖家', avatar: 'https://test.invalid/peer-new' } });
  page.renderMessages();
  page.onAvatarError({ currentTarget: { dataset: { from: 'me', url: systemAvatar } } });
  page.onAvatarError({ currentTarget: { dataset: { from: 'other', url: 'https://test.invalid/broken' } } });
  assert.equal(page.data.avatars.me.url, 'https://test.invalid/self-new');
  assert.equal(page.data.avatars.other.url, 'https://test.invalid/peer-new');
  page.onAvatarError({ currentTarget: { dataset: { from: 'other', url: 'https://test.invalid/peer-new' } } });
  assert.deepEqual(page.data.avatars.other, { url: '', initial: '新' });
});

test('account changes reject late message responses and avatar events without rebinding the old page', async t => {
  const { page, storage } = pageFixture(t);
  storage.set('userInfo', { logged: true, openid: 'buyer', nickname: '买家', avatar: 'https://test.invalid/buyer' });
  page.renderMessages();
  page.onInput({ detail: { value: 'buyer draft' } });
  const pending = deferred();
  api.getMessages = () => pending.promise;
  const loading = page.loadMessages();
  const before = structuredClone(page.data);
  storage.set('userInfo', { logged: true, openid: 'seller', nickname: '卖家', avatar: 'https://test.invalid/seller' });
  page.renderMessages();
  page.onAvatarError({ currentTarget: { dataset: { from: 'me', url: 'https://test.invalid/buyer' } } });
  pending.resolve(ok({ list: [messageAt('late', '11:31:00')], total: 1,
    session: { name: '新头像', avatar: 'https://test.invalid/late' }, permissions: state() }));
  await loading;
  assert.deepEqual(page.data, before);
  assert.equal(page.owner, 'buyer');
  assert.equal(storage.has('chat:v1:seller:S1'), false);
});

for (const [olderTime, expectedLabels] of [
  ['11:33:00', ['09-05 11:33', '']],
  ['11:30:00', ['09-05 11:30', '09-05 11:35']],
]) {
  test(`loading older ${olderTime} recomputes the former first separator without extra messages or scroll`, async t => {
    const { page } = pageFixture(t); const requestedPages = [];
    api.getMessages = async ({ page: requestPage }) => {
      requestedPages.push(requestPage);
      return ok({ list: [requestPage === 1 ? messageAt('latest', '11:35:00') : messageAt('older', olderTime)],
        total: 2, session: { name: '卖家' }, permissions: state() });
    };
    await page.loadMessages(true);
    assert.deepEqual(page.data.messages.map(item => item.timeLabel), ['09-05 11:35']);
    assert.equal(page.data.hasMore, true);
    const scrollBefore = page.data.scrollToView;
    page.nearBottom = false;
    await page.loadMessages(false, true);
    assert.deepEqual(page.data.messages.map(item => item.id), ['older', 'latest']);
    assert.deepEqual(page.data.messages.map(item => item.timeLabel), expectedLabels);
    assert.deepEqual(requestedPages, [1, 2]);
    assert.equal(page.page, 2); assert.equal(page.remote.length, 2); assert.equal(page.outbox.length, 0);
    assert.equal(page.data.hasMore, false); assert.equal(page.data.scrollToView, scrollBefore);
  });
}

test('polling and new messages preserve historical reading while active sending still scrolls', async t => {
  const { page } = pageFixture(t);
  let list = [messageAt('first', '11:31:00'), messageAt('last', '11:35:00')];
  api.getMessages = async () => ok({ list, total: list.length, session: { name: '卖家' }, permissions: state() });
  await page.loadMessages(true);
  page.listHeight = 500;
  page.onScroll({ detail: { scrollHeight: 2000, scrollTop: 100 } });
  assert.equal(page.nearBottom, false);
  const scrollUpdates = [], setData = page.setData;
  page.setData = function (updates) {
    if (Object.prototype.hasOwnProperty.call(updates, 'scrollToView')) scrollUpdates.push(updates.scrollToView);
    setData.call(this, updates);
  };
  await page.loadMessages(); await page.loadMessages();
  list = [...list, messageAt('incoming', '11:40:00')];
  await page.loadMessages();
  assert.deepEqual(scrollUpdates, []);
  assert.deepEqual(page.data.messages.map(item => item.timeLabel), ['09-05 11:31', '', '09-05 11:40']);
  const pending = deferred();
  api.sendMessage = () => pending.promise;
  page.onInput({ detail: { value: 'new local message' } });
  const sending = page.onSend();
  await tick();
  const local = page.outbox[0];
  assert.deepEqual(scrollUpdates, [`msg-${local.id}`]);
  pending.resolve(sent({ clientMessageId: local.clientMessageId, type: local.type,
    content: local.text, createdTimestamp: local.createdTimestamp }));
  await sending; await tick();
  assert.equal(page.data.messages.length, 4);
});

for (const type of ['text', 'image']) {
  test(`restored ${type} keeps the first time through a lost response and retry acknowledgment`, async t => {
    const pending = messageAt(`local-${type}`, '11:31:00', { from: 'me', type, clientMessageId: `restore-${type}`,
      text: type === 'text' ? 'retained draft' : '[图片]', draftRevision: 3, status: 'sending',
      ...(type === 'image' ? { image: { localPath: 'saved.png', extension: 'png', size: 100, width: 10, height: 20 } } : {}),
    });
    const { page, storage } = pageFixture(t, 'chat', [['chat:v1:buyer:S1', {
      draft: 'retained draft', revision: 3, outbox: [pending],
    }]]);
    assert.equal(page.data.messages[0].status, 'failed');
    assert.equal(page.data.messages[0].timeLabel, '09-05 11:31');
    const submissions = [];
    let committed;
    api.prepareChatImage = async () => ok(committed ? { message: committed } : { cloudPath: 'stage' });
    api.sendMessage = async data => {
      submissions.push({ ...data });
      if (!committed) { committed = sent(data).result.data.message; throw new Error('response lost after commit'); }
      return ok({ message: committed });
    };
    await page.submit(page.outbox[0]);
    assert.equal(page.data.messages[0].status, 'failed');
    assert.equal(page.data.messages[0].timeLabel, '09-05 11:31');
    await page.submit(page.outbox[0]); await tick();
    assert.equal(page.outbox.length, 0);
    assert.equal(page.data.messages.length, 1);
    assert.equal(page.data.messages[0].status, 'sent');
    assert.equal(page.data.messages[0].clientMessageId, pending.clientMessageId);
    assert.equal(page.data.messages[0].createdTimestamp, pending.createdTimestamp);
    assert.equal(page.data.messages[0].timeLabel, '09-05 11:31');
    assert.equal(submissions.length, type === 'image' ? 1 : 2);
    assert.ok(submissions.every(item => item.createdTimestamp === pending.createdTimestamp));
    assert.equal(page.data.input, type === 'text' ? '' : 'retained draft');
    assert.deepEqual(storage.get('chat:v1:buyer:S1').outbox, []);
  });
}

test('empty and invalid-time messages remain readable and display metadata never enters stored business messages', t => {
  const { page, storage } = pageFixture(t);
  assert.deepEqual(page.data.messages, []);
  const remote = [{ id: 'a-invalid', type: 'text', text: 'readable history', from: 'other', status: 'sent', time: '11:20' }];
  const outbox = [messageAt('b-local', '11:31:00', { from: 'me', status: 'failed', clientMessageId: 'local-metadata' })];
  page.remote = structuredClone(remote); page.outbox = structuredClone(outbox);
  page.renderMessages(); page.persist();
  assert.deepEqual(page.data.messages.map(item => item.text), ['readable history', 'b-local']);
  assert.deepEqual(page.data.messages.map(item => item.timeLabel), ['', '09-05 11:31']);
  assert.deepEqual(page.remote, remote); assert.deepEqual(page.outbox, outbox);
  assert.deepEqual(storage.get('chat:v1:buyer:S1').outbox, outbox);
});

test('read-only history keeps avatars and times while image preview uses only the business message ID', async t => {
  const { page } = pageFixture(t); const previews = [], requests = [];
  const blocked = { available: false, reason: '当前无法与该用户联系' };
  api.getMessages = async () => ok({
    list: [messageAt('text', '11:31:00'), messageAt('photo', '11:36:00', {
      type: 'image', image: { url: 'https://test.invalid/old-photo', width: 10, height: 20 },
    })], total: 2, session: { name: '卖家', avatar: 'https://test.invalid/peer' },
    permissions: { canSend: false, sendReason: blocked.reason, wechat: blocked, phone: blocked },
  });
  api.getChatImage = async data => { requests.push(data); return ok({ url: 'https://test.invalid/current-photo' }); };
  global.wx.previewImage = async data => { previews.push(data); };
  await page.loadMessages();
  assert.equal(page.data.permissions.canSend, false);
  assert.equal(page.data.avatars.other.url, 'https://test.invalid/peer');
  assert.deepEqual(page.data.messages.map(item => item.timeLabel), ['09-05 11:31', '09-05 11:36']);
  page.onAvatarError({ currentTarget: { dataset: { from: 'other', url: 'https://test.invalid/peer' } } });
  await page.onPreviewImage({ currentTarget: { dataset: { id: 'text' } } });
  assert.deepEqual(previews, []); assert.deepEqual(requests, []);
  await page.onPreviewImage({ currentTarget: { dataset: { id: 'photo' } } });
  assert.deepEqual(requests, [{ sessionId: 'S1', messageId: 'photo' }]);
  assert.deepEqual(previews, [{ current: 'https://test.invalid/current-photo', urls: ['https://test.invalid/current-photo'] }]);
  assert.equal(page.data.permissions.canSend, false);
});

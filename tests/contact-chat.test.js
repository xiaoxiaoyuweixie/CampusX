const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/cloud');
const { imageFormat, MAX_IMAGE_BYTES } = require('../cloudfunctions/chatService/lib/image-format');
const chatState = require('../miniprogram/utils/chat-state');

const message = (id = 'request_001', extra = {}) => ({ sessionId: 'S1', clientMessageId: id, content: '你好', ...extra });

test('new contact defaults are private; arbitrary strings and empty saves preserve the other item', async () => {
  const f = fixture();
  assert.deepEqual((await f.user('getContacts')).data, { wechat: { value: '', enabled: false }, phone: { value: '', enabled: false } });
  const saved = await f.user('saveContact', { type: 'phone', value: '  +00 Not-A-Phone  ' });
  assert.equal(saved.data.phone.value, '  +00 Not-A-Phone  ');
  assert.equal(saved.data.phone.enabled, true);
  assert.equal(saved.data.wechat.enabled, false);
  await f.user('setContactEnabled', { type: 'phone', enabled: false });
  assert.equal((await f.user('getContacts')).data.phone.value, '  +00 Not-A-Phone  ');
  const cleared = await f.user('saveContact', { type: 'phone', value: '' });
  assert.deepEqual(cleared.data.phone, { value: '', enabled: true });
});

test('contact mutation refuses another identity, disabled users and failed writes', async () => {
  const f = fixture();
  assert.equal((await f.user('saveContact', { type: 'phone', value: 'x', openid: 'seller' })).code, 40003);
  assert.equal(f.tables().users.seller.contacts.phone.value, '001234');
  f.state.failWrites = true;
  assert.notEqual((await f.user('saveContact', { type: 'phone', value: 'x' })).code, 0);
  assert.equal(f.tables().users.buyer.contacts, undefined);
  f.state.failWrites = false;
  f.tables().users.buyer.status = 'disabled';
  assert.notEqual((await f.user('saveContact', { type: 'phone', value: 'x' })).code, 0);
});

test('concurrent contact updates are independent and complete atomically', async () => {
  const f = fixture();
  await Promise.all([f.user('saveContact', { type: 'wechat', value: 'ABC' }), f.user('saveContact', { type: 'phone', value: '0001' })]);
  assert.deepEqual((await f.user('getContacts')).data, { wechat: { value: 'ABC', enabled: true }, phone: { value: '0001', enabled: true } });
});

for (const [value, masked] of [['abcdef', 'ab****f'], ['abcd', 'ab****d'], ['abc', '****'], ['a', '****']]) {
  test(`WeChat masks ${value}, returns full value only for copy`, async () => {
    const f = fixture(); f.tables().users.seller.contacts.wechat.value = value;
    const preview = await f.chat('getContact', { sessionId: 'S1', type: 'wechat', purpose: 'preview' });
    assert.deepEqual(preview.data, { masked });
    assert.equal((await f.chat('getContact', { sessionId: 'S1', type: 'wechat', purpose: 'copy' })).data.value, value);
  });
}

test('availability is unilateral, independent, and requires a nonempty saved value', async () => {
  const f = fixture();
  const state = (await f.chat('getChatState', { sessionId: 'S1' })).data;
  assert.equal(state.wechat.available, true); assert.equal(state.phone.available, true);
  assert.equal(JSON.stringify(state).includes('abcdef'), false);
  assert.equal(JSON.stringify(state).includes('001234'), false);
  f.tables().users.seller.contacts.wechat.value = '';
  assert.equal((await f.chat('getChatState', { sessionId: 'S1' })).data.wechat.available, false);
  assert.equal((await f.chat('getContact', { sessionId: 'S1', type: 'wechat', purpose: 'copy' })).message, '对方暂未开放微信联系方式');
  assert.equal((await f.chat('getContact', { sessionId: 'S1', type: 'phone', purpose: 'call' })).data.value, '001234');
});

test('copy rechecks current number and status inside the transaction', async () => {
  const f = fixture();
  await f.chat('getContact', { sessionId: 'S1', type: 'wechat', purpose: 'preview' });
  f.tables().users.seller.contacts.wechat.value = 'new-value';
  assert.equal((await f.chat('getContact', { sessionId: 'S1', type: 'wechat', purpose: 'copy' })).data.value, 'new-value');
  f.state.beforeTransaction = () => { f.tables().users.seller.contacts.wechat.enabled = false; };
  assert.equal((await f.chat('getContact', { sessionId: 'S1', type: 'wechat', purpose: 'copy' })).message, '对方暂未开放微信联系方式');
});

for (const status of ['off_shelf', 'sold']) {
  test(`${status}: empty sessions and unrelated history never permit first send or contact`, async () => {
    const f = fixture();
    f.tables().products.product.status = status;
    f.tables().chat_sessions.session.lastMessage = { content: 'ghost' };
    f.tables().chat_messages.other = { _id: 'other', sessionId: 'OTHER', status: 'sent' };
    assert.notEqual((await f.chat('sendMessage', message())).code, 0);
    assert.notEqual((await f.chat('openSession', { productId: 'P1' })).code, 0);
    assert.notEqual((await f.chat('getContact', { sessionId: 'S1', type: 'phone', purpose: 'call' })).code, 0);
  });
  test(`${status}: successful history permits only continued messaging`, async () => {
    const f = fixture();
    assert.equal((await f.chat('sendMessage', message())).code, 0);
    f.tables().products.product.status = status;
    assert.equal((await f.chat('openSession', { productId: 'P1' })).data.sessionId, 'S1');
    assert.equal((await f.chat('sendMessage', message('request_002'))).code, 0);
    assert.notEqual((await f.chat('getContact', { sessionId: 'S1', type: 'wechat', purpose: 'copy' })).code, 0);
  });
}

test('disabled peer takes priority, history remains readable, all send/contact paths are denied', async () => {
  const f = fixture();
  await f.chat('sendMessage', message());
  f.tables().users.seller.status = 'disabled';
  f.tables().products.product.status = 'sold';
  assert.equal((await f.chat('getMessages', { sessionId: 'S1' })).data.list.length, 1);
  for (const [action, data] of [['sendMessage', message('request_002')], ['openSession', { productId: 'P1' }],
    ['getContact', { sessionId: 'S1', type: 'wechat', purpose: 'copy' }],
    ['prepareImage', { sessionId: 'S1', clientMessageId: 'image_001', extension: 'png', size: 32 }]]) {
    assert.equal((await f.chat(action, data)).message, '当前无法与该用户联系');
  }
});

test('all session actions reject nonparticipants and never leak contact values or stack traces', async () => {
  const f = fixture(); f.state.openid = 'outsider';
  for (const action of ['getMessages', 'getChatState', 'getContact', 'getImage', 'sendMessage', 'prepareImage', 'markRead']) {
    const result = await f.chat(action, message('request_001', { type: 'wechat', purpose: 'copy' }));
    assert.notEqual(result.code, 0); assert.equal(result.data, null);
    assert.equal(JSON.stringify(result).includes('abcdef'), false);
  }
});

test('text is unchanged, rejects whitespace, and uses Unicode code points for 1000 limit', async () => {
  const f = fixture();
  for (const content of ['', ' \n\t ', 'a'.repeat(1001)]) assert.notEqual((await f.chat('sendMessage', message('request_001', { content }))).code, 0);
  const exact = '😀'.repeat(1000);
  assert.equal((await f.chat('sendMessage', message('request_002', { content: exact }))).code, 0);
  assert.equal(chatState.textError(exact), ''); assert.notEqual(chatState.textError(exact + 'a'), '');
  const preserved = '  hello \n world  ';
  assert.equal((await f.chat('sendMessage', message('request_003', { content: preserved }))).data.message.text, preserved);
});

test('parallel retries and lost responses produce one message and one unread increment', async () => {
  const f = fixture();
  const results = await Promise.all(Array.from({ length: 4 }, () => f.chat('sendMessage', message())));
  assert.ok(results.every(result => result.code === 0));
  assert.equal(new Set(results.map(result => result.data.message.id)).size, 1);
  await f.chat('sendMessage', message());
  assert.equal(Object.keys(f.tables().chat_messages).length, 1);
  assert.equal(f.tables().chat_sessions.session.unreadCount.seller, 1);
  await f.chat('sendMessage', message('request_002'));
  assert.equal(Object.keys(f.tables().chat_messages).length, 2);
});

test('legacy text callers remain usable and an explicit submission ID cannot change its content', async () => {
  const f = fixture();
  assert.equal((await f.chat('sendMessage', { sessionId: 'S1', content: 'legacy text' })).code, 0);
  assert.equal((await f.chat('sendMessage', message())).code, 0);
  assert.equal((await f.chat('sendMessage', message('request_001', { content: 'changed' }))).code, 40900);
  assert.equal(Object.keys(f.tables().chat_messages).length, 2);
});

test('send checks permission again at commit, and failed writes do not create successful history', async () => {
  const f = fixture();
  f.state.beforeTransaction = () => { f.tables().products.product.status = 'sold'; };
  assert.notEqual((await f.chat('sendMessage', message())).code, 0);
  assert.equal(Object.keys(f.tables().chat_messages).length, 0);
  f.tables().products.product.status = 'on_sale'; f.state.failWrites = true;
  const result = await f.chat('sendMessage', message());
  assert.equal(result.code, 50000); assert.equal(result.data, null);
  assert.equal(f.tables().chat_sessions.session.unreadCount.seller, 0);
});

test('concurrent opens deduplicate the same participant/product conversation', async () => {
  const f = fixture(); delete f.tables().chat_sessions.session;
  const results = await Promise.all([f.chat('openSession', { productId: 'P1' }), f.chat('openSession', { productId: 'P1' })]);
  assert.ok(results.every(result => result.code === 0));
  assert.equal(Object.keys(f.tables().chat_sessions).length, 1);
});

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/9sAAAAASUVORK5CYII=', 'base64');
test('image inspection accepts static PNG and rejects mislabeled, animated and malformed content', () => {
  assert.equal(imageFormat(png), 'png');
  assert.equal(imageFormat(Buffer.from('GIF89a000000000000')), '');
  const chunk = Buffer.alloc(12); chunk.write('acTL', 4);
  assert.equal(imageFormat(Buffer.concat([png.subarray(0, 33), chunk, png.subarray(33)])), '');
  assert.equal(imageFormat(png.subarray(0, 15)), '');
});

test('image flow validates ownership and bytes; stored image is server-owned and read is authorized', async () => {
  const f = fixture();
  const data = message('image_001', { type: 'image' });
  const prepared = await f.chat('prepareImage', { ...data, extension: 'png', size: png.length });
  const fileID = `cloud://test.bucket/${prepared.data.cloudPath}`;
  f.state.files.set(fileID, png);
  const result = await f.chat('sendMessage', { ...data, image: { fileID, width: 1, height: 1 } });
  assert.equal(result.code, 0);
  const raw = Object.values(f.tables().chat_messages)[0];
  assert.ok(raw.image.fileID.startsWith('cloud://test.bucket/chat-media/'));
  assert.equal(JSON.stringify(result).includes(raw.image.fileID), false);
  assert.equal((await f.chat('getImage', { sessionId: 'S1', messageId: raw.messageId })).code, 0);
  assert.equal((await f.chat('prepareImage', { ...data, extension: 'png', size: png.length })).data.message.id, raw.messageId);
  assert.notEqual((await f.chat('sendMessage', { ...message('image_002', { type: 'image' }), image: { fileID } })).code, 0);
  assert.notEqual((await f.chat('prepareImage', { ...message('image_003'), extension: 'png', size: MAX_IMAGE_BYTES + 1 })).code, 0);
});

test('product detail exposes only public seller fields', async () => {
  const f = fixture();
  const product = f.load('cloudfunctions/product/index.js');
  const result = await product.main({ action: 'getProductDetail', data: { id: 'P1' } });
  assert.equal(result.code, 0);
  assert.equal(result.data.seller.contacts, undefined);
  assert.equal(JSON.stringify(result).includes('abcdef'), false);
});

test('drafts and outbox are isolated by account/session and clear only the submitted revision', () => {
  const values = new Map();
  global.wx = { getStorageSync: key => values.get(key), setStorageSync: (key, value) => values.set(key, structuredClone(value)) };
  chatState.write('one', 'a', { draft: 'draft', revision: 1, outbox: [{ status: 'sending' }] });
  assert.equal(chatState.read('one', 'a').draft, 'draft');
  assert.equal(chatState.read('one', 'a').outbox[0].status, 'failed');
  assert.equal(chatState.read('two', 'a').draft, ''); assert.equal(chatState.read('one', 'b').draft, '');
  const outgoing = { type: 'text', text: 'draft', draftRevision: 1 };
  assert.equal(chatState.acknowledgedDraft('draft', 1, outgoing), true);
  assert.equal(chatState.acknowledgedDraft('draft', 2, outgoing), false);
  assert.equal(chatState.acknowledgedDraft('new', 2, outgoing), false);
  delete global.wx;
});

test('message reconciliation removes acknowledged duplicate bubbles and preserves image selection order', () => {
  const remote = [{ id: 'server', clientMessageId: 'first', from: 'me', createdTimestamp: 1 }];
  const pending = [{ id: 'local', clientMessageId: 'first', createdTimestamp: 1 },
    { id: 'third', clientMessageId: 'third', createdTimestamp: 3 }, { id: 'second', clientMessageId: 'second', createdTimestamp: 2 }];
  assert.deepEqual(chatState.mergeMessages(remote, pending).map(item => item.id), ['server', 'second', 'third']);
});

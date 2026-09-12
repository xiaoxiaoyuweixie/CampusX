const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { fixture } = require('./helpers/cloud');

async function adminFixture() {
  const f = fixture();
  const password = crypto.randomBytes(16).toString('hex');
  const salt = crypto.randomBytes(12).toString('hex');
  f.tables().admins = { root: { _id: 'root', username: 'test-admin', status: 'enabled', role: 'super_admin', salt,
    passwordHash: crypto.createHash('sha256').update(`${salt}:${password}`).digest('hex') } };
  const service = f.load('cloudfunctions/adminService/index.js');
  const login = await service.main({ action: 'login', data: { username: 'test-admin', password } });
  assert.equal(login.code, 0);
  const token = login.data.token;
  return { ...f, service, token, call: (action, data = {}) => service.main({ action, data: { token, ...data } }) };
}

test('enabled super admins can read complete contacts even when sharing is off or the user is disabled', async () => {
  const f = await adminFixture();
  const user = f.tables().users.seller;
  Object.assign(user, { status: 'disabled', bio: '个性签名\n第二行', gender: '女', updatedAt: '2026-09-08T01:00:00Z' });
  user.contacts.wechat = { enabled: false, value: '  campusx-完整微信  ' };
  user.contacts.phone = { enabled: false, value: '+86 13800000000' };
  const before = structuredClone(f.tables());
  const result = await f.call('getUserDetail', { id: 'seller' });
  assert.equal(result.code, 0);
  assert.equal(result.data.bio, user.bio);
  assert.equal(result.data.account, user.account);
  assert.equal(result.data.gender, '女');
  assert.equal(result.data.status, 'disabled');
  assert.equal(result.data.updatedAt, user.updatedAt);
  assert.deepEqual(result.data.contacts, user.contacts);
  assert.deepEqual(f.tables(), before);
});

test('detail has an explicit field allowlist and the user list still omits contacts', async () => {
  const f = await adminFixture();
  Object.assign(f.tables().users.seller, { passwordHash: 'not-for-detail', token: 'not-for-detail', internalNote: 'not-for-detail' });
  const detail = await f.call('getUserDetail', { id: 'seller' });
  assert.deepEqual(Object.keys(detail.data).sort(), ['_id', 'nickname', 'account', 'gender', 'bio', 'status', 'updatedAt', 'contacts'].sort());
  assert.equal(JSON.stringify(detail.data).includes('not-for-detail'), false);
  const list = await f.call('listUsers');
  assert.equal(list.code, 0);
  assert.ok(list.data.list.every(user => !Object.hasOwn(user, 'contacts')));
});

test('missing profile data and empty contacts have safe defaults', async () => {
  const f = await adminFixture();
  f.tables().users.outsider.createdAt = '2026-09-01T00:00:00Z';
  let result = await f.call('getUserDetail', { id: 'outsider' });
  assert.deepEqual(result.data.contacts, { wechat: { value: '', enabled: false }, phone: { value: '', enabled: false } });
  assert.equal(result.data.bio, '');
  assert.equal(result.data.gender, '未知');
  assert.equal(result.data.updatedAt, '2026-09-01T00:00:00Z');
  f.tables().users.outsider.contacts = { wechat: { value: '', enabled: true }, phone: { value: 123, enabled: 'true' } };
  result = await f.call('getUserDetail', { id: 'outsider' });
  assert.deepEqual(result.data.contacts, { wechat: { value: '', enabled: true }, phone: { value: '', enabled: false } });
});

test('detail rejects unauthenticated, forged, disabled, non-super-admin and expired access', async t => {
  const f = await adminFixture();
  for (const token of ['', 'forged-token']) {
    const result = await f.call('getUserDetail', { id: 'seller', token });
    assert.equal(result.code, 40004);
    assert.equal(result.data, null);
  }
  f.tables().admins.root.status = 'disabled';
  assert.equal((await f.call('getUserDetail', { id: 'seller' })).code, 40004);
  f.tables().admins.root.status = 'enabled';
  f.tables().admins.root.role = 'viewer';
  assert.equal((await f.call('getUserDetail', { id: 'seller' })).code, 40004);
  f.tables().admins.root.role = 'super_admin';
  const future = Date.now() + 25 * 60 * 60 * 1000;
  t.mock.method(Date, 'now', () => future);
  assert.equal((await f.call('getUserDetail', { id: 'seller' })).code, 40004);
});

test('invalid user IDs and missing users return Chinese business errors', async () => {
  const f = await adminFixture();
  for (const id of [undefined, '', ' ', 1, { $ne: null }, ['seller']]) {
    const result = await f.call('getUserDetail', { id });
    assert.equal(result.code, 40001);
    assert.equal(result.message, '请选择要查看的用户');
    assert.equal(result.data, null);
  }
  const missing = await f.call('getUserDetail', { id: 'does-not-exist' });
  assert.equal(missing.code, 40400);
  assert.equal(missing.message, '用户不存在或已被删除');
});

test('the HTTP action follows the POST envelope and database failures expose no internals', async () => {
  const f = await adminFixture();
  const response = await f.service.main({ httpMethod: 'POST', body: JSON.stringify({ action: 'getUserDetail', data: { id: 'seller', token: f.token } }) });
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).data._id, 'seller');
  const collection = f.db.collection;
  f.db.collection = name => {
    if (name === 'users') throw new Error('private database connection details');
    return collection(name);
  };
  const result = await f.call('getUserDetail', { id: 'seller' });
  assert.equal(result.code, 50000);
  assert.equal(result.message, '用户信息加载失败，请稍后重试');
  assert.equal(result.data, null);
});

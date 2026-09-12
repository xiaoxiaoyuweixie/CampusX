const test = require('node:test');
const assert = require('node:assert/strict');

function viewFixture(t) {
  let html = '', active = true;
  const renders = [], events = new Map();
  const previous = global.document;
  global.document = { querySelector(selector) {
    assert.equal(active, true, 'a stale response must not bind handlers');
    if (!html.includes(selector.slice(1, -1))) return null;
    return { addEventListener: (event, callback) => events.set(`${selector}:${event}`, callback) };
  } };
  t.after(() => { if (previous === undefined) delete global.document; else global.document = previous; });
  return {
    renderApp(content) { if (!active) return false; html = content; renders.push(content); return true; },
    leave() { active = false; html = 'another-page'; },
    get html() { return html; }, renders, events,
  };
}

test('user detail renders all requested fields as read-only escaped text', async () => {
  const { renderUserDetail } = await import('../admin-web/src/views/user-detail.js');
  const html = renderUserDetail({ nickname: '<img src=x onerror=alert(1)>', account: '220000000000001', gender: '女',
    bio: '签名第一行\n第二行', status: 'disabled', updatedAt: '2026-09-08T01:00:00Z',
    contacts: { wechat: { value: '  wx<&"  ', enabled: false }, phone: { value: '+86 13800000000', enabled: true } } });
  for (const label of ['昵称', '账号', '性别', '个性签名', '状态', '更新时间', '微信号', '电话号码']) assert.ok(html.includes(`<dt>${label}</dt>`));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('  wx&lt;&amp;&quot;  '));
  assert.ok(html.includes('签名第一行\n第二行'));
  assert.ok(html.includes('未对外开放'));
  assert.ok(html.includes('已对外开放'));
  assert.ok(html.includes('+86 13800000000'));
  assert.equal(/<(input|textarea|select|img)\b/.test(html), false);
});

test('empty contacts and profile fields are labelled without invented information', async () => {
  const { renderUserDetail } = await import('../admin-web/src/views/user-detail.js');
  const html = renderUserDetail({});
  assert.ok(html.includes('未填写'));
  assert.equal((html.match(/未对外开放/g) || []).length, 2);
  assert.equal(html.includes('undefined'), false);
  assert.equal(html.includes('null'), false);
});

test('detail queries the selected user and binds back navigation after loading', async t => {
  const { loadUserDetail } = await import('../admin-web/src/views/user-detail.js');
  const f = viewFixture(t); let back = 0;
  await loadUserDetail({ userId: 'seller', renderApp: f.renderApp, onBackToUsers: () => { back += 1; },
    adminCall: async (action, data) => { assert.equal(action, 'getUserDetail'); assert.deepEqual(data, { id: 'seller' }); return { nickname: '测试用户' }; } });
  assert.ok(f.renders[0].includes('用户信息加载中'));
  assert.ok(f.html.includes('测试用户'));
  f.events.get('[data-user-back]:click')();
  assert.equal(back, 1);
});

test('missing users and network failures retain back/retry and show readable messages', async t => {
  const { loadUserDetail } = await import('../admin-web/src/views/user-detail.js');
  const f = viewFixture(t); let retries = 0;
  const context = { userId: 'seller', renderApp: f.renderApp, onBackToUsers() {}, onRetry: () => { retries += 1; } };
  await loadUserDetail({ ...context, adminCall: async () => { throw Object.assign(new Error('用户不存在或已被删除'), { code: 40400 }); } });
  assert.ok(f.html.includes('用户不存在或已被删除'));
  f.events.get('[data-user-detail-retry]:click')();
  assert.equal(retries, 1);
  await loadUserDetail({ ...context, adminCall: async () => { throw new TypeError('Failed to fetch'); } });
  assert.ok(f.html.includes('用户信息加载失败，请稍后重试'));
  assert.equal(f.html.includes('Failed to fetch'), false);
});

test('expired authentication is passed to the application login handler', async t => {
  const { loadUserDetail } = await import('../admin-web/src/views/user-detail.js');
  const f = viewFixture(t);
  await assert.rejects(loadUserDetail({ userId: 'seller', renderApp: f.renderApp, onBackToUsers() {},
    adminCall: async () => { throw Object.assign(new Error('登录已失效，请重新登录'), { code: 40004 }); } }), { code: 40004 });
  assert.equal(f.renders.length, 1);
});

test('a response arriving after leaving the detail view never renders or binds private data', async t => {
  const { loadUserDetail } = await import('../admin-web/src/views/user-detail.js');
  const f = viewFixture(t); let resolve;
  const response = new Promise(done => { resolve = done; });
  const loading = loadUserDetail({ userId: 'seller', renderApp: f.renderApp, onBackToUsers() {}, adminCall: () => response });
  f.leave();
  resolve({ nickname: '不可再次展示', contacts: { phone: { value: '13800000000', enabled: false } } });
  await loading;
  assert.equal(f.html, 'another-page');
  assert.equal(f.renders.length, 1);
});

test('user list adds view without removing the existing status operation', async t => {
  const { loadUsers } = await import('../admin-web/src/views/users.js');
  const callbacks = new Map(); let html = '', viewed;
  const previous = global.document;
  const button = (name, dataset) => ({ dataset, addEventListener: (_, fn) => callbacks.set(name, fn) });
  global.document = { querySelectorAll: selector => selector === '[data-user-view]'
    ? [button('view', { userView: 'seller' })] : [button('status', { userStatus: 'seller', status: 'disabled' })] };
  t.after(() => { if (previous === undefined) delete global.document; else global.document = previous; });
  const calls = [];
  await loadUsers({ renderApp: content => { html = content; }, onViewUser: id => { viewed = id; },
    adminCall: async (action, data) => { calls.push({ action, data }); return { list: [{ _id: 'seller', nickname: '测试用户', status: 'enabled' }] }; } });
  assert.ok(html.includes('data-user-view="seller"'));
  assert.ok(html.includes('data-user-status="seller"'));
  callbacks.get('view')();
  assert.equal(viewed, 'seller');
  await callbacks.get('status')();
  assert.ok(calls.some(call => call.action === 'updateUserStatus' && call.data.id === 'seller' && call.data.status === 'disabled'));
});

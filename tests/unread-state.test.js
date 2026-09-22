const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { api } = require('../miniprogram/api');
const getUnreadState = api.getUnreadState;
const READ_ICONS = { iconPath: 'images/tab-message.png', selectedIconPath: 'images/tab-message-active.png' };
const UNREAD_ICONS = { iconPath: 'images/tab-message-unread.png', selectedIconPath: 'images/tab-message-active-unread.png' };

const tick = () => new Promise(resolve => setImmediate(resolve));
const ok = data => ({ result: { code: 0, data } });
function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function fixture(t, user = { logged: true, openid: 'A' }) {
  const savedApi = { ...api };
  const globals = ['wx', 'App', 'Page', 'getApp', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'];
  const savedGlobals = new Map(globals.map(key => [key, global[key]]));
  const storage = new Map([['userInfo', user]]);
  const timers = new Map(), dots = [], calls = [], pages = [], loaded = [], forbiddenNativeCalls = [];
  let now = 0, nextId = 0, visibleIcons = { ...READ_ICONS }, systemDot = true, nativeAvailable = true, app;
  const timer = (callback, delay, interval = false) => {
    const id = ++nextId;
    timers.set(id, { callback, delay, due: now + delay, interval });
    return id;
  };
  global.setTimeout = (callback, delay) => timer(callback, delay);
  global.clearTimeout = id => timers.delete(id);
  global.setInterval = (callback, delay) => timer(callback, delay, true);
  global.clearInterval = id => timers.delete(id);
  const draw = options => {
    const icons = { iconPath: options.iconPath, selectedIconPath: options.selectedIconPath };
    dots.push({ ...icons, index: options.index });
    if (nativeAvailable) visibleIcons = icons;
    else options.fail({ errMsg: 'not a TabBar page' });
  };
  global.wx = {
    getStorageSync: key => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, structuredClone(value)),
    removeStorageSync: key => storage.delete(key),
    setTabBarItem: draw,
    showTabBarRedDot: () => forbiddenNativeCalls.push('showTabBarRedDot'),
    hideTabBarRedDot: options => {
      if (nativeAvailable) systemDot = false;
      else if (options.fail) options.fail({ errMsg: 'not a TabBar page' });
    },
    setTabBarBadge: () => forbiddenNativeCalls.push('setTabBarBadge'),
    showToast() {}, showLoading() {}, hideLoading() {}, reLaunch() {}, redirectTo() {}, setNavigationBarTitle() {},
    cloud: { init() {} },
  };
  api.getUnreadState = async () => { calls.push(storage.get('userInfo').openid); return ok({ hasUnread: false }); };
  api.systemNoticeList = async () => ok([]);
  api.getSessionList = async () => ok({ list: [], total: 0 });
  api.getRecommendedProducts = api.listProducts = async () => ok({ list: [] });
  api.getCategories = async () => ok([{ id: 'digital', name: '数码' }]);
  api.getDashboard = async () => ok({ publishedCount: 0, favoriteCount: 0 });
  const unreadFile = require.resolve('../miniprogram/utils/unread');
  const previousUnread = require.cache[unreadFile];
  delete require.cache[unreadFile];
  const unread = require(unreadFile);
  function load(file) {
    const resolved = require.resolve(file);
    loaded.push([resolved, require.cache[resolved]]);
    delete require.cache[resolved];
    require(resolved);
  }
  function loadApp() {
    global.App = value => { app = value; };
    global.getApp = () => app;
    load('../miniprogram/app');
    app.onLaunch();
    return app;
  }
  function page(name) {
    let definition;
    global.Page = value => { definition = value; };
    load(`../miniprogram/pages/${name}/index`);
    const instance = { ...definition, data: structuredClone(definition.data),
      setData(update, callback) {
        for (const [key, value] of Object.entries(update)) {
          const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.');
          let target = this.data;
          for (const part of parts.slice(0, -1)) target = target[part] || (target[part] = {});
          target[parts.at(-1)] = value;
        }
        if (callback) callback();
      },
    };
    pages.push(instance);
    return instance;
  }
  t.after(() => {
    unread.pause();
    for (const instance of pages) if (instance.onUnload) instance.onUnload();
    Object.assign(api, savedApi);
    for (const [file, previous] of loaded.reverse()) {
      if (previous) require.cache[file] = previous;
      else delete require.cache[file];
    }
    if (previousUnread) require.cache[unreadFile] = previousUnread;
    else delete require.cache[unreadFile];
    for (const [key, value] of savedGlobals) {
      if (value === undefined) delete global[key];
      else global[key] = value;
    }
    assert.deepEqual(forbiddenNativeCalls, [], 'Use the bundled red-dot icons, without a system red dot or numeric badge');
  });
  return { unread, storage, timers, dots, calls, loadApp, page,
    dot: () => visibleIcons.iconPath === UNREAD_ICONS.iconPath && visibleIcons.selectedIconPath === UNREAD_ICONS.selectedIconPath,
    icons: () => ({ ...visibleIcons }),
    systemDot: () => systemDot,
    nativeAvailable: value => { nativeAvailable = value; },
    account: openid => storage.set('userInfo', { logged: !!openid, openid }),
    advance(milliseconds) {
      now += milliseconds;
      for (const [id, value] of [...timers]) {
        if (value.due > now) continue;
        if (value.interval) value.due = now + value.delay;
        else timers.delete(id);
        value.callback();
      }
    },
  };
}

test('unread adapter calls the authenticated chat service action without client identity', async t => {
  fixture(t);
  let request;
  wx.cloud.callFunction = async value => { request = value; return ok({ hasUnread: true }); };
  const response = await getUnreadState();
  assert.equal(response.result.data.hasUnread, true);
  assert.deepEqual(request, { name: 'chatService', data: { action: 'getUnreadState', data: {} } });
});

test('App launch is idle; foreground polls at five seconds after completion and background stops polling', async t => {
  const f = fixture(t), app = f.loadApp();
  assert.equal(f.unread.POLL_INTERVAL, 5000);
  await f.unread.refresh();
  assert.equal(f.calls.length, 0);
  app.onShow(); await tick();
  assert.deepEqual(f.calls, ['A']);
  assert.equal(f.timers.size, 1);
  f.advance(4999); await tick(); assert.equal(f.calls.length, 1);
  f.advance(1); await tick(); assert.equal(f.calls.length, 2);
  app.onHide();
  assert.equal(f.timers.size, 0);
  f.advance(60000); await tick(); assert.equal(f.calls.length, 2);
  app.onShow(); await tick(); assert.equal(f.calls.length, 3);
});

test('guests and logged-in storage without a usable openid never request unread state', async t => {
  const f = fixture(t, { logged: false, openid: 'old-account' });
  await f.unread.start();
  f.storage.set('userInfo', { logged: true });
  await f.unread.accountChanged();
  f.storage.set('userInfo', { logged: true, openid: 123 });
  await f.unread.start();
  f.advance(60000); await tick();
  assert.equal(f.calls.length, 0);
  assert.equal(f.timers.size, 0);
  assert.equal(f.dot(), false);
});

test('backgrounding before the API microtask cancels dispatch instead of making an unnecessary request', async t => {
  const f = fixture(t);
  const refresh = f.unread.start();
  f.unread.pause();
  await refresh;
  assert.equal(f.calls.length, 0);
  assert.equal(f.timers.size, 0);
});

test('authority keeps a dot until every conversation is read without consulting the first session page', async t => {
  const f = fixture(t);
  const unreadSessions = new Set(['session-1', 'session-65']);
  api.getSessionList = () => assert.fail('A session page is not an account-wide unread source');
  api.getUnreadState = async () => ok({ hasUnread: unreadSessions.size > 0 });
  await f.unread.start(); assert.equal(f.dot(), true);
  unreadSessions.delete('session-1');
  await f.unread.refresh(); assert.equal(f.dot(), true);
  unreadSessions.delete('session-65');
  await f.unread.refresh(); assert.equal(f.dot(), false);
  assert.equal(f.dots.every(event => event.index === 3), true);
});

test('native message Tab switches normal and selected icons together and restores the original pair on read or logout', async t => {
  const f = fixture(t);
  for (const relativePath of [...Object.values(READ_ICONS), ...Object.values(UNREAD_ICONS)]) {
    assert.equal(fs.existsSync(path.join(__dirname, '../miniprogram', relativePath)), true, `Bundled Tab icon exists: ${relativePath}`);
  }
  const configured = require('../miniprogram/app.json').tabBar.list[3];
  assert.deepEqual({ iconPath: configured.iconPath, selectedIconPath: configured.selectedIconPath }, READ_ICONS);
  let hasUnread = true;
  api.getUnreadState = async () => ok({ hasUnread });
  await f.unread.start();
  assert.deepEqual(f.icons(), UNREAD_ICONS);
  assert.equal(f.systemDot(), false, 'An existing system red dot is cleared to avoid showing two dots');
  hasUnread = false;
  await f.unread.refresh();
  assert.deepEqual(f.icons(), READ_ICONS);
  hasUnread = true;
  await f.unread.refresh();
  assert.deepEqual(f.icons(), UNREAD_ICONS);
  f.account(''); await f.unread.accountChanged();
  assert.deepEqual(f.icons(), READ_ICONS);
});

test('network errors, business failures and malformed responses preserve the last authoritative dot', async t => {
  const f = fixture(t), events = [];
  f.unread.subscribe(event => events.push(event));
  api.getUnreadState = async () => ok({ hasUnread: true });
  await f.unread.start();
  const successfulEvents = events.filter(event => event.type === 'refresh').length;
  for (const bad of [undefined, {}, { result: {} }, { result: { code: 40001, data: { hasUnread: false } } },
    ok(null), ok({}), ok({ hasUnread: 0 }), ok({ hasUnread: 'false' })]) {
    api.getUnreadState = async () => bad;
    await f.unread.refresh();
    assert.equal(f.dot(), true);
    assert.equal(f.timers.size, 1);
  }
  api.getUnreadState = async () => { throw new Error('offline'); };
  await f.unread.refresh();
  assert.equal(f.dot(), true);
  assert.equal(events.filter(event => event.type === 'refresh').length, successfulEvents);
  api.getUnreadState = async () => ok({ hasUnread: false });
  await f.unread.refresh(); assert.equal(f.dot(), false);
});

test('a failed first unread request emits no all-read result and retries on the next polling cycle', async t => {
  const f = fixture(t), events = []; let requests = 0;
  f.unread.subscribe(event => events.push(event));
  api.getUnreadState = async () => {
    requests += 1;
    if (requests === 1) throw new Error('offline');
    return ok({ hasUnread: true });
  };
  await f.unread.start();
  assert.equal(events.filter(event => event.type === 'refresh').length, 0);
  assert.equal(f.timers.size, 1);
  f.advance(5000); await tick();
  assert.equal(requests, 2);
  assert.equal(f.dot(), true);
  assert.equal(events.filter(event => event.type === 'refresh').length, 1);
});

test('unsubscribed or broken page listeners cannot stop global unread polling', async t => {
  const f = fixture(t), events = [];
  f.unread.subscribe(() => { throw new Error('disposed page'); });
  const unsubscribe = f.unread.subscribe(event => events.push(event));
  await f.unread.start();
  const count = events.length;
  unsubscribe();
  f.advance(5000); await tick();
  assert.equal(f.calls.length, 2);
  assert.equal(events.length, count);
  assert.equal(f.timers.size, 1);
});

test('slow requests coalesce repeated foreground and refresh events into one follow-up without overlap', async t => {
  const f = fixture(t), pending = [];
  let concurrent = 0, maxConcurrent = 0;
  api.getUnreadState = () => {
    const request = deferred(); pending.push(request);
    concurrent += 1; maxConcurrent = Math.max(maxConcurrent, concurrent);
    return request.promise.finally(() => { concurrent -= 1; });
  };
  f.unread.start(); await tick();
  for (let index = 0; index < 20; index += 1) { f.unread.start(); f.unread.refresh(); }
  f.advance(60000); await tick();
  assert.equal(pending.length, 1);
  assert.equal(f.timers.size, 0);
  pending[0].resolve(ok({ hasUnread: true })); await tick();
  assert.equal(pending.length, 2);
  assert.equal(f.timers.size, 0);
  pending[1].resolve(ok({ hasUnread: false })); await tick();
  assert.equal(maxConcurrent, 1);
  assert.equal(f.timers.size, 1);
  f.advance(4999); await tick(); assert.equal(pending.length, 2);
  f.advance(1); await tick(); assert.equal(pending.length, 3);
  pending[2].resolve(ok({ hasUnread: false })); await tick();
});

test('a background response cannot draw or restart polling and foreground requests fresh authority', async t => {
  const f = fixture(t), pending = deferred();
  api.getUnreadState = () => pending.promise;
  f.unread.start(); await tick();
  f.unread.pause(); const draws = f.dots.length;
  pending.resolve(ok({ hasUnread: true })); await tick();
  assert.equal(f.dots.length, draws);
  assert.equal(f.timers.size, 0);
  api.getUnreadState = async () => ok({ hasUnread: true });
  await f.unread.start();
  assert.equal(f.dot(), true);
  assert.equal(f.timers.size, 1);
});

test('background then foreground during a slow request waits for it and rejects its stale result', async t => {
  const f = fixture(t), first = deferred(), second = deferred(); let requests = 0;
  api.getUnreadState = () => (++requests === 1 ? first : second).promise;
  f.unread.start(); await tick();
  f.unread.pause(); f.unread.start(); f.unread.start(); await tick();
  assert.equal(requests, 1);
  first.resolve(ok({ hasUnread: true })); await tick();
  assert.equal(requests, 2);
  assert.equal(f.dot(), false);
  second.resolve(ok({ hasUnread: true })); await tick();
  assert.equal(f.dot(), true);
  assert.equal(f.timers.size, 1);
});

test('logout clears the previous dot and rejects a late response without more guest requests', async t => {
  const f = fixture(t);
  api.getUnreadState = async () => ok({ hasUnread: true });
  await f.unread.start();
  const pending = deferred();
  api.getUnreadState = () => pending.promise;
  f.unread.refresh(); await tick();
  f.account(''); f.unread.accountChanged();
  assert.equal(f.dot(), false);
  pending.resolve(ok({ hasUnread: true })); await tick();
  assert.equal(f.dot(), false);
  assert.equal(f.timers.size, 0);
});

test('account switch cannot apply old unread results and serializes the new account request', async t => {
  const f = fixture(t), pendingA = deferred(), pendingB = deferred(), owners = [];
  api.getUnreadState = () => {
    const owner = f.unread.currentOwner(); owners.push(owner);
    return (owner === 'A' ? pendingA : pendingB).promise;
  };
  f.unread.start(); await tick();
  f.account('B'); f.unread.accountChanged(); await tick();
  assert.deepEqual(owners, ['A']);
  pendingA.resolve(ok({ hasUnread: true })); await tick();
  assert.deepEqual(owners, ['A', 'B']);
  assert.equal(f.dot(), false);
  pendingB.resolve(ok({ hasUnread: true })); await tick();
  assert.equal(f.dot(), true);
});

test('A to B to A still rejects the first A response using the account generation', async t => {
  const f = fixture(t), first = deferred(), latest = deferred(), owners = [];
  api.getUnreadState = () => {
    owners.push(f.unread.currentOwner());
    return (owners.length === 1 ? first : latest).promise;
  };
  f.unread.start(); await tick();
  f.account('B'); f.unread.accountChanged();
  f.account('A'); f.unread.accountChanged();
  first.resolve(ok({ hasUnread: true })); await tick();
  assert.deepEqual(owners, ['A', 'A']);
  assert.equal(f.dot(), false);
  latest.resolve(ok({ hasUnread: false })); await tick();
  assert.equal(f.dot(), false);
});

test('native drawing failure on a non-Tab page is retried on Tab show, even if refresh fails', async t => {
  const f = fixture(t);
  f.nativeAvailable(false);
  api.getUnreadState = async () => ok({ hasUnread: true });
  await f.unread.start(); assert.equal(f.dot(), false);
  f.nativeAvailable(true);
  api.getUnreadState = async () => { throw new Error('offline'); };
  await f.page('publish').onShow(); await tick();
  assert.equal(f.dot(), true);
});

test('each actual Tab onShow refreshes authority and uses the same single polling timer', async t => {
  const f = fixture(t); f.loadApp();
  await f.unread.start();
  for (const name of ['home', 'category', 'publish', 'message', 'profile']) {
    const before = f.calls.length, page = f.page(name);
    await page.onShow(); await tick();
    assert.equal(f.calls.length, before + 1, `${name} refreshes unread on show`);
    assert.equal(f.timers.size, 1, `${name} shares the global timer`);
    if (page.onHide) page.onHide();
  }
});

test('actual login success refreshes new account before navigation and actual logout clears it', async t => {
  const f = fixture(t, { logged: false }), app = f.loadApp();
  app.onShow(); await tick(); assert.equal(f.calls.length, 0);
  const login = f.page('login'); login.onLoad({});
  login.setData({ account: 'test-account', password: 'fixture-only', agreed: true });
  api.login = async () => ok({ token: 'fixture-token', user: { openid: 'B', nickname: '测试' } });
  api.getUnreadState = async () => { f.calls.push(f.unread.currentOwner()); return ok({ hasUnread: true }); };
  await login.handleLogin(); await tick();
  assert.deepEqual(f.calls, ['B']);
  assert.equal(f.dot(), true);
  assert.equal(f.storage.get('userInfo').logged, true);
  f.page('settings').performLogout(); await tick();
  assert.equal(f.dot(), false);
  assert.equal(f.storage.get('userInfo').logged, false);
  // Only the pre-existing login navigation timeout remains; unread polling was removed.
  assert.equal([...f.timers.values()].some(value => value.delay === 5000), false);
});

test('successful message reading refreshes account authority and keeps other conversations unread', async t => {
  const f = fixture(t), sessions = new Set(['S1', 'S2']);
  api.getUnreadState = async () => ok({ hasUnread: sessions.size > 0 });
  await f.unread.start(); assert.equal(f.dot(), true);
  const chat = f.page('chat'); chat.onLoad({ sessionId: 'S1' });
  const permissions = { canSend: true, wechat: { available: true }, phone: { available: true } };
  api.getMessages = async () => {
    sessions.delete(chat.sessionId);
    return ok({ list: [], total: 0, session: { name: '同学' }, permissions });
  };
  await chat.loadMessages(); await tick(); assert.equal(f.dot(), true);
  chat.sessionId = 'S2';
  await chat.loadMessages(); await tick(); assert.equal(f.dot(), false);
  await f.page('message').onShow(); await tick(); assert.equal(f.dot(), false);
});

test('failed chat reads never trigger a false all-read state', async t => {
  const f = fixture(t); let queries = 0;
  api.getUnreadState = async () => { queries += 1; return ok({ hasUnread: true }); };
  await f.unread.start();
  const chat = f.page('chat'); chat.onLoad({ sessionId: 'S1' });
  api.getMessages = async () => { throw new Error('offline'); };
  await chat.loadMessages(); await tick();
  assert.equal(queries, 1);
  assert.equal(f.dot(), true);
});

test('visible message list follows global polling and preserves previous rows when listing fails', async t => {
  const f = fixture(t); let requests = 0, noticeRequests = 0;
  api.systemNoticeList = async () => { noticeRequests += 1; return ok([]); };
  api.getSessionList = async () => { requests += 1; return ok({ list: [{ id: 'S1', unread: requests }] }); };
  await f.unread.start();
  const message = f.page('message');
  await message.onShow(); await tick();
  const before = requests;
  f.advance(5000); await tick();
  assert.equal(requests, before + 1);
  assert.equal(noticeRequests, 1, 'Global unread polling does not poll the legacy notice service');
  assert.equal(message.data.chats[0].unread, requests);
  const saved = structuredClone(message.data.chats);
  api.getSessionList = async () => { throw new Error('offline'); };
  f.advance(5000); await tick();
  assert.deepEqual(message.data.chats, saved);
  message.onHide();
  api.getSessionList = () => assert.fail('Hidden message page must unsubscribe from refresh');
  f.advance(5000); await tick();
  assert.deepEqual(message.data.chats, saved);
});

test('message list never derives Tab red dot from its first 50 rows', async t => {
  const f = fixture(t);
  api.getUnreadState = async () => ok({ hasUnread: true });
  api.getSessionList = async ({ page, pageSize }) => {
    assert.deepEqual({ page, pageSize }, { page: 1, pageSize: 50 });
    return ok({ list: Array.from({ length: 50 }, (_, index) => ({ id: `S${index}`, unread: 0 })), total: 65 });
  };
  await f.unread.start();
  const message = f.page('message');
  await message.onShow(); await tick();
  assert.equal(message.data.chats.length, 50);
  assert.equal(f.dot(), true);
});

test('message list coalesces reloads and discards an old account response after an account swap', async t => {
  const f = fixture(t), old = deferred(), latest = deferred(), owners = [];
  api.getSessionList = () => {
    owners.push(f.unread.currentOwner());
    return (owners.length === 1 ? old : latest).promise;
  };
  await f.unread.start();
  const message = f.page('message');
  const opening = message.onShow(); await tick();
  for (let index = 0; index < 10; index += 1) message.loadData(false);
  assert.deepEqual(owners, ['A']);
  f.account('B'); await f.unread.accountChanged(); await tick();
  assert.deepEqual(message.data.chats, []);
  old.resolve(ok({ list: [{ id: 'old-A', unread: 9 }] })); await opening; await tick();
  assert.deepEqual(message.data.chats, []);
  assert.deepEqual(owners, ['A', 'B']);
  latest.resolve(ok({ list: [{ id: 'new-B', unread: 0 }] })); await tick();
  assert.deepEqual(message.data.chats, [{ id: 'new-B', unread: 0 }]);
});

test('message list drops responses after hide or unload and reloads when shown again', async t => {
  const f = fixture(t), old = deferred();
  api.getSessionList = () => old.promise;
  await f.unread.start();
  const message = f.page('message');
  const opening = message.onShow(); await tick();
  message.onHide();
  old.resolve(ok({ list: [{ id: 'hidden-result', unread: 1 }] })); await opening; await tick();
  assert.deepEqual(message.data.chats, []);
  api.getSessionList = async () => ok({ list: [{ id: 'current', unread: 0 }] });
  await message.onShow(); await tick();
  assert.deepEqual(message.data.chats, [{ id: 'current', unread: 0 }]);
  const late = deferred(); api.getSessionList = () => late.promise;
  const refresh = message.loadData(false); await tick();
  message.onUnload();
  late.resolve(ok({ list: [{ id: 'unloaded-result', unread: 1 }] })); await refresh; await tick();
  assert.deepEqual(message.data.chats, [{ id: 'current', unread: 0 }]);
});

test('message list clears old rows immediately when shown after an account switch while hidden', async t => {
  const f = fixture(t);
  api.getSessionList = async () => ok({ list: [{ id: 'account-A', unread: 2 }] });
  await f.unread.start();
  const message = f.page('message');
  await message.onShow(); await tick();
  assert.equal(message.data.chats[0].id, 'account-A');
  message.onHide();
  f.account('B'); await f.unread.accountChanged();
  const pending = deferred(); api.getSessionList = () => pending.promise;
  const opening = message.onShow();
  assert.deepEqual(message.data.chats, []);
  pending.resolve(ok({ list: [{ id: 'account-B', unread: 0 }] }));
  await opening; await tick();
  assert.deepEqual(message.data.chats, [{ id: 'account-B', unread: 0 }]);
});

test('profile dashboard response cannot restore login or overwrite a different account after logout', async t => {
  const f = fixture(t), pending = deferred();
  api.getDashboard = () => pending.promise;
  await f.unread.start();
  const profile = f.page('profile');
  const loading = profile.onShow(); await tick();
  f.page('settings').performLogout();
  f.account('B'); await f.unread.accountChanged();
  pending.resolve(ok({ user: { openid: 'A', nickname: 'old-user' }, publishedCount: 9 }));
  await loading; await tick();
  assert.deepEqual(f.storage.get('userInfo'), { logged: true, openid: 'B' });
  assert.equal(profile.data.publishedCount, 0);
  assert.notEqual(profile.data.user.nickname, 'old-user');
});

test('settings profile query cannot revive a logged-out account', async t => {
  const f = fixture(t), pending = deferred();
  api.getUserInfo = () => pending.promise;
  await f.unread.start();
  const settings = f.page('settings');
  const loading = settings.syncProfileFromCloud();
  settings.performLogout();
  pending.resolve(ok({ openid: 'A', nickname: 'old-user' })); await loading;
  assert.equal(f.storage.get('userInfo').logged, false);
  assert.notEqual(f.storage.get('userInfo').nickname, 'old-user');
  assert.equal(f.dot(), false);
});

test('settings profile save cannot overwrite a new account with the previous account response', async t => {
  const f = fixture(t), pending = deferred();
  api.updateUserInfo = () => pending.promise;
  await f.unread.start();
  const settings = f.page('settings');
  const saving = settings.saveProfile({ nickname: 'old-edit' });
  f.account('B'); await f.unread.accountChanged();
  pending.resolve(ok({ openid: 'A', nickname: 'old-edit' }));
  assert.equal(await saving, false);
  assert.deepEqual(f.storage.get('userInfo'), { logged: true, openid: 'B' });
  assert.notEqual(settings.data.profile.nickname, 'old-edit');
});

test('same-account logout and relogin rejects previous dashboard, profile query and profile save responses', async t => {
  const f = fixture(t), dashboard = deferred(), query = deferred(), save = deferred();
  api.getDashboard = () => dashboard.promise;
  api.getUserInfo = () => query.promise;
  api.updateUserInfo = () => save.promise;
  await f.unread.start();
  const profile = f.page('profile'), settings = f.page('settings');
  const loadingDashboard = profile.onShow();
  const loadingProfile = settings.syncProfileFromCloud();
  const savingProfile = settings.saveProfile({ nickname: 'old-edit' });
  settings.performLogout();
  f.storage.set('userInfo', { logged: true, openid: 'A', nickname: 'new-session' });
  await f.unread.accountChanged();
  dashboard.resolve(ok({ user: { openid: 'A', nickname: 'old-dashboard' }, favoriteCount: 6 }));
  query.resolve(ok({ openid: 'A', nickname: 'old-query' }));
  save.resolve(ok({ openid: 'A', nickname: 'old-edit' }));
  await Promise.all([loadingDashboard, loadingProfile, savingProfile]);
  assert.equal(f.storage.get('userInfo').nickname, 'new-session');
  assert.equal(profile.data.favoriteCount, 0);
  assert.equal(await savingProfile, false);
});

test('foreground pause does not invalidate same-account profile changes that complete in the background', async t => {
  const f = fixture(t), pending = deferred();
  await f.unread.start();
  const settings = f.page('settings'), account = f.unread.captureAccount();
  api.updateUserInfo = () => pending.promise;
  const saving = settings.saveProfile({ nickname: 'valid-edit' });
  f.unread.pause();
  assert.equal(f.unread.isCurrentAccount(account), true);
  pending.resolve(ok({ openid: 'A', nickname: 'valid-edit' }));
  assert.equal(await saving, true);
  assert.equal(f.storage.get('userInfo').nickname, 'valid-edit');
  assert.equal(f.timers.size, 0);
});

test('guests do not issue profile requests capable of restoring a stale logged-in session', async t => {
  const f = fixture(t, { logged: false, openid: 'A' });
  api.getDashboard = api.getUserInfo = api.updateUserInfo = () => assert.fail('Guest must not request private profile data');
  const settings = f.page('settings');
  await f.page('profile').onShow();
  await settings.syncProfileFromCloud();
  assert.equal(await settings.saveProfile({ nickname: 'guest-edit' }), false);
  assert.equal(f.storage.get('userInfo').logged, false);
});

test('avatar upload cannot submit a profile update under a replacement account', async t => {
  const f = fixture(t), pending = deferred(), uploads = [];
  await f.unread.start();
  const settings = f.page('settings');
  settings.uploadAvatar = (filePath, cloudPath) => { uploads.push({ filePath, cloudPath }); return pending.promise; };
  api.updateUserInfo = () => assert.fail('Old avatar upload must not write to the new account');
  const saving = settings.updateAvatar('/tmp/avatar.png');
  assert.match(uploads[0].cloudPath, /^avatar\/A-\d+\.png$/);
  f.account('B'); await f.unread.accountChanged();
  pending.resolve({ fileID: 'cloud://fixture/old-avatar' });
  await saving;
  assert.deepEqual(f.storage.get('userInfo'), { logged: true, openid: 'B' });
});

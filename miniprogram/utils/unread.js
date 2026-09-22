const { api } = require('../api/index.js');
const storage = require('./storage.js');

const POLL_INTERVAL = 5000;
const MESSAGE_TAB_INDEX = 3;
let foreground = false;
let owner = '';
let generation = 0;
let accountVersion = 0;
let hasUnread = null;
let timer = null;
let inFlight = null;
let refreshQueued = false;
const listeners = new Set();

function currentOwner() {
  const user = storage.get('userInfo', {}) || {};
  return user.logged && typeof user.openid === 'string' ? user.openid : '';
}

function notify(type) {
  listeners.forEach(listener => {
    try { listener({ type, owner }); } catch (err) { /* A page must not stop global polling. */ }
  });
}

function draw() {
  if (!foreground) return;
  // Clear the system dot: its fixed position would overlap the dot in our icons.
  if (typeof wx.hideTabBarRedDot === 'function') {
    try { wx.hideTabBarRedDot({ index: MESSAGE_TAB_INDEX, fail() {} }); } catch (err) {}
  }
  if (typeof wx.setTabBarItem !== 'function') return;
  const suffix = hasUnread === true ? '-unread' : '';
  // A non-Tab page may not have a native TabBar; reapply on the next Tab show.
  try {
    wx.setTabBarItem({
      index: MESSAGE_TAB_INDEX,
      iconPath: `images/tab-message${suffix}.png`,
      selectedIconPath: `images/tab-message-active${suffix}.png`,
      fail() {},
    });
  } catch (err) {}
}

function clearTimer() {
  if (timer !== null) clearTimeout(timer);
  timer = null;
}

function resetOwner(nextOwner) {
  owner = nextOwner;
  generation += 1;
  accountVersion += 1;
  hasUnread = null;
  clearTimer();
  refreshQueued = false;
  draw();
  notify('reset');
}

function syncOwner() {
  const nextOwner = currentOwner();
  if (owner !== nextOwner) resetOwner(nextOwner);
}

function captureAccount() {
  syncOwner();
  return owner ? { owner, version: accountVersion } : null;
}

function isCurrentAccount(account) {
  syncOwner();
  return !!owner && !!account && account.owner === owner && account.version === accountVersion;
}

function schedule() {
  clearTimer();
  if (foreground && owner) timer = setTimeout(() => { timer = null; refresh(); }, POLL_INTERVAL);
}

function refresh() {
  syncOwner();
  if (!foreground) return Promise.resolve();
  draw();
  clearTimer();
  if (!owner) return Promise.resolve();
  if (inFlight) {
    // Coalesce Tab changes, reads and foreground events into at most one follow-up.
    refreshQueued = true;
    return inFlight;
  }
  const requestOwner = owner;
  const requestGeneration = generation;
  inFlight = Promise.resolve().then(() => {
    if (!foreground || generation !== requestGeneration || currentOwner() !== requestOwner) return null;
    return api.getUnreadState();
  }).then(res => {
    if (!foreground || generation !== requestGeneration || currentOwner() !== requestOwner) return;
    const result = res && res.result;
    if (!result || result.code !== 0 || !result.data || typeof result.data.hasUnread !== 'boolean') return;
    hasUnread = result.data.hasUnread;
    draw();
    notify('refresh');
  }).catch(() => {
    // Network and business failures preserve this account's last authoritative state.
  }).finally(() => {
    inFlight = null;
    syncOwner();
    if (!foreground || !owner) return;
    if (refreshQueued) {
      refreshQueued = false;
      refresh();
    } else schedule();
  });
  return inFlight;
}

function start() {
  foreground = true;
  return refresh();
}

function pause() {
  foreground = false;
  generation += 1;
  refreshQueued = false;
  clearTimer();
}

function accountChanged() {
  resetOwner(currentOwner());
  return refresh();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

module.exports = { start, pause, refresh, accountChanged, subscribe, currentOwner, captureAccount, isCurrentAccount, POLL_INTERVAL };

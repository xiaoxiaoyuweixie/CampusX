const test = require('node:test');
const assert = require('node:assert/strict');

const tick = () => new Promise(resolve => setImmediate(resolve));
const ok = data => ({ result: { code: 0, data } });
function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function fixture(t) {
  const globals = new Map(['wx', 'Page', 'getApp'].map(key => [key, global[key]]));
  const files = ['../miniprogram/pages/home/index', '../miniprogram/utils/router', '../miniprogram/utils/unread']
    .map(file => require.resolve(file));
  const cache = new Map(files.map(file => [file, require.cache[file]]));
  files.forEach(file => { delete require.cache[file]; });
  const calls = [], tabBar = [], navigation = [], app = { globalData: {} };
  const handlers = {
    'category.getCategories': async () => ok([]),
    'product.getRecommendedProducts': async () => ok({ list: [] }),
    'product.listProducts': async () => ok({ list: [] }),
  };
  let definition, stopped = 0, unreadRefreshes = 0;
  global.Page = value => { definition = value; };
  global.getApp = () => app;
  global.wx = {
    getWindowInfo: () => ({ windowWidth: 375, windowHeight: 700 }),
    hideTabBar: options => tabBar.push({ method: 'hide', ...options }),
    showTabBar: options => tabBar.push({ method: 'show', ...options }),
    switchTab: options => navigation.push({ method: 'switchTab', ...options }),
    navigateTo: options => navigation.push({ method: 'navigateTo', url: options.url }),
    stopPullDownRefresh: () => { stopped += 1; },
    cloud: {
      callFunction: async request => {
        calls.push(structuredClone(request));
        const handler = handlers[`${request.name}.${request.data.action}`];
        assert.equal(typeof handler, 'function', `Unexpected cloud request: ${request.name}.${request.data.action}`);
        return handler(request.data.data);
      },
    },
  };
  require(files[2]).refresh = () => { unreadRefreshes += 1; };
  require(files[0]);
  const page = {
    ...definition,
    data: structuredClone(definition.data),
    setData(update, callback) { Object.assign(this.data, update); if (callback) callback(); },
  };
  t.after(() => {
    page.onUnload();
    for (const [file, previous] of cache) {
      if (previous) require.cache[file] = previous;
      else delete require.cache[file];
    }
    for (const [key, value] of globals) {
      if (value === undefined) delete global[key];
      else global[key] = value;
    }
  });
  return { page, handlers, calls, tabBar, navigation, app,
    stopped: () => stopped, unreadRefreshes: () => unreadRefreshes };
}

function tapAssistant(page) {
  page.onAssistantTouchStart({ touches: [{ clientX: 300, clientY: 500 }] });
  page.onAssistantTouchEnd({ changedTouches: [{ clientX: 300, clientY: 500 }] });
}

test('initial home uses real recommended products and preserves their content and ordering', async t => {
  const f = fixture(t);
  const products = [
    { id: 'real-2', title: '当前账号发布的工具箱', price: 16.8, campus: '校内交易地点', sellerName: '真实发布者', views: 7, cover: 'cloud://env/real-cover', categoryId: 'dorm' },
    { _id: 'real-1', title: '另一件真实资源', price: 0, campus: '', sellerName: '另一位同学', views: 0, images: ['cloud://env/first-image'] },
  ];
  f.handlers['product.getRecommendedProducts'] = async () => ok({ list: products });
  await f.page.onLoad();
  assert.deepEqual(f.calls.find(call => call.name === 'product'), {
    name: 'product', data: { action: 'getRecommendedProducts', data: { page: 1, pageSize: 20 } },
  });
  assert.deepEqual(f.page.data.products, [products[0], { ...products[1], id: 'real-1', cover: products[1].images[0] }]);
  assert.equal(f.page.data.assistantReady, true);
});

test('category artwork follows category identity while keeping server names, order and unknown icons', async t => {
  const f = fixture(t);
  const categories = ['skill', 'book', 'dorm', 'digital', 'kaoyan'].map((id, index) => ({
    id, categoryId: id, name: `后台名称${index}`, icon: `旧图标${index}`, status: 'enabled', sort: 20 - index,
  }));
  categories.push({ id: 'legacy-id', categoryId: 'digital', name: '别名分类', icon: '📟', sort: 50, status: 'enabled' });
  categories.push({ id: 'new-category', name: '数码电子', icon: '🛹', sort: 99, status: 'enabled' });
  categories.push({ id: 'constructor', name: '新增手工分类', icon: '🧶', sort: 100, status: 'enabled' });
  categories.push({ id: 'toString', name: '新增音乐分类', icon: '🎸', sort: 101, status: 'enabled' });
  const original = structuredClone(categories);
  f.handlers['category.getCategories'] = async () => ok(categories);
  await f.page.loadCategories();
  assert.deepEqual(f.calls, [{ name: 'category', data: { action: 'getCategories' } }]);
  assert.deepEqual(f.page.data.categories, original.map((item, index) => ({
    ...item, id: item.categoryId || item.id,
    iconSrc: index < 6 ? `/images/home/category-${item.categoryId || item.id}.png` : '',
  })));
  assert.deepEqual(categories, original, 'Presentation adaptation must not mutate the API result');
});

test('existing category fallback also receives artwork when the request fails', async t => {
  const f = fixture(t);
  f.handlers['category.getCategories'] = async () => { throw new Error('offline'); };
  await f.page.loadCategories();
  assert.deepEqual(f.page.data.categories.map(item => item.id), ['digital', 'kaoyan', 'book', 'skill', 'dorm']);
  assert.ok(f.page.data.categories.every(item => item.iconSrc === `/images/home/category-${item.id}.png` && item.name && item.icon));
});

test('typing does not search until confirmation and cancel restores recommendations', async t => {
  const f = fixture(t);
  const result = { id: 'search-result', title: '真实高数教材', price: 12, cover: 'cloud://env/math' };
  f.handlers['product.listProducts'] = async () => ok({ list: [result] });
  f.page.onSearchInput({ detail: { value: '  高数  ' } });
  assert.equal(f.page.data.keyword, '  高数  ');
  assert.equal(f.calls.length, 0);
  f.page.onSearchConfirm({ detail: { value: '  高数  ' } });
  await tick();
  assert.equal(f.page.data.keyword, '高数');
  assert.deepEqual(f.calls[0], {
    name: 'product', data: { action: 'listProducts', data: { keyword: '高数', page: 1, pageSize: 20, status: 'on_sale' } },
  });
  assert.deepEqual(f.page.data.products, [result]);
  f.page.onSearchCancel();
  await tick();
  assert.equal(f.page.data.keyword, '');
  assert.equal(f.calls[1].data.action, 'getRecommendedProducts');
  assert.deepEqual(f.page.data.products, []);
});

test('returning to home preserves the active search and refreshes the shared unread state', async t => {
  const f = fixture(t);
  f.page.setData({ keyword: '耳机' });
  await f.page.onShow();
  assert.equal(f.unreadRefreshes(), 1);
  assert.equal(f.page.data.keyword, '耳机');
  assert.equal(f.calls[0].data.action, 'listProducts');
  assert.equal(f.calls[0].data.data.keyword, '耳机');
});

test('pull-down refresh keeps the search and stops its indicator after the response settles', async t => {
  const f = fixture(t), response = deferred();
  f.page.setData({ keyword: '台灯', products: [{ id: 'previous' }] });
  f.handlers['product.listProducts'] = () => response.promise;
  f.page.onPullDownRefresh();
  assert.equal(f.stopped(), 0);
  assert.equal(f.calls[0].data.data.keyword, '台灯');
  response.resolve({ result: { code: 50000, message: '暂时不可用', data: null } });
  await tick();
  assert.equal(f.stopped(), 1);
  assert.deepEqual(f.page.data.products, [{ id: 'previous' }]);
});

test('category and product taps retain their existing real-data destinations', t => {
  const f = fixture(t);
  f.page.onCategoryTap({ currentTarget: { dataset: { id: 'book' } } });
  assert.equal(f.app.globalData.selectedCategory, 'book');
  assert.deepEqual(f.navigation[0], { method: 'switchTab', url: '/pages/category/index' });
  f.page.onProductTap({ detail: { id: 'resource / 42' } });
  assert.deepEqual(f.navigation[1], { method: 'navigateTo', url: '/pages/detail/index?id=resource%20%2F%2042' });
});

test('dragging or cancelling the assistant keeps it on screen without opening the sheet', t => {
  const f = fixture(t), page = f.page;
  page.setupAssistantPosition();
  page.onAssistantTouchStart({ touches: [{ clientX: 300, clientY: 500 }] });
  page.onAssistantTouchMove({ touches: [{ clientX: -1000, clientY: -1000 }] });
  page.onAssistantTouchEnd({ changedTouches: [{ clientX: -1000, clientY: -1000 }] });
  assert.equal(page.data.assistantX, 0); assert.equal(page.data.assistantY, 0);
  assert.equal(page.data.assistantOpen, false);
  page.onAssistantTouchStart({ touches: [{ clientX: 0, clientY: 0 }] });
  page.onAssistantTouchEnd({ changedTouches: [{ clientX: 50, clientY: 50 }] });
  assert.equal(page.data.assistantOpen, false, 'A missing move event must not turn a drag into a tap');
  page.onAssistantTouchStart({ touches: [{ clientX: 0, clientY: 0 }] });
  page.onAssistantTouchCancel();
  page.onAssistantTouchEnd({ changedTouches: [{ clientX: 0, clientY: 0 }] });
  assert.deepEqual(f.tabBar, []);
});

test('assistant tap and close preserve native TabBar visibility and conversation across page hiding', t => {
  const f = fixture(t), page = f.page;
  page.setupAssistantPosition();
  page.setData({ assistantInput: '尚未发送的问题' });
  const messages = structuredClone(page.data.assistantMessages);
  tapAssistant(page);
  assert.equal(page.data.assistantOpen, true);
  assert.equal(page.data.assistantScrollIntoView, messages.at(-1).id);
  page.onAssistantSheetTap();
  assert.equal(page.data.assistantOpen, true);
  page.onAssistantClose(); page.onAssistantClose();
  assert.equal(page.data.assistantOpen, false);
  tapAssistant(page); page.onHide();
  assert.equal(page.data.assistantOpen, false);
  assert.equal(page.data.assistantInput, '尚未发送的问题');
  assert.deepEqual(page.data.assistantMessages, messages);
  assert.deepEqual(f.tabBar, ['hide', 'show', 'hide', 'show'].map(method => ({ method, animation: false })));
});

test('window resizing keeps a previously dragged assistant inside the new viewport', t => {
  const f = fixture(t), page = f.page;
  page.setupAssistantPosition();
  page.onAssistantTouchStart({ touches: [{ clientX: 0, clientY: 0 }] });
  page.onAssistantTouchMove({ touches: [{ clientX: 9999, clientY: 9999 }] });
  page.onAssistantTouchEnd({ changedTouches: [{ clientX: 9999, clientY: 9999 }] });
  page.onResize({ size: { windowWidth: 320, windowHeight: 400 } });
  assert.ok(page.data.assistantX >= 0 && page.data.assistantX + 112 * 320 / 750 <= 320);
  assert.ok(page.data.assistantY >= 0 && page.data.assistantY + 112 * 320 / 750 <= 400);
  assert.equal(page.data.assistantOpen, false);
});

test('assistant sends real context once, keeps newer input and renders returned resources and rule sources', async t => {
  const f = fixture(t), response = deferred(), page = f.page;
  f.handlers['aiAssistant.chat'] = () => response.promise;
  page.onAssistantInput({ detail: { value: '   找一本教材   ' } });
  const sending = page.onAssistantSend();
  page.onAssistantInput({ detail: { value: '下一个问题' } });
  await page.onAssistantSend();
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.calls[0], {
    name: 'aiAssistant', data: { action: 'chat', data: { messages: [
      { role: 'assistant', content: page.data.assistantMessages[0].content },
      { role: 'user', content: '找一本教材' },
    ] } },
  });
  const product = { _id: 'real-ai-resource', title: '卖家的教材', price: 9, location: '东门', cover: 'cloud://env/ai-cover' };
  response.resolve(ok({ content: '找到一件在售资源', sources: [{ title: '交易规则' }, { title: '交易规则' }, { title: '发布规则' }], products: [product, { title: '无有效商品ID' }] }));
  await sending;
  const reply = page.data.assistantMessages.at(-1);
  assert.equal(reply.content, '找到一件在售资源');
  assert.equal(reply.sourceText, '交易规则、发布规则');
  assert.deepEqual(reply.products, [{ ...product, id: product._id }]);
  assert.equal(page.data.assistantInput, '下一个问题');
  assert.equal(page.data.assistantReplying, false);
  page.onAssistantProductTap({ currentTarget: { dataset: { id: product._id } } });
  assert.equal(f.navigation[0].url, '/pages/detail/index?id=real-ai-resource');
});

test('assistant ignores blank sends and recovers from business and network failures', async t => {
  const f = fixture(t), page = f.page;
  page.onAssistantInput({ detail: { value: '  ' } });
  await page.onAssistantSend();
  assert.equal(f.calls.length, 0);
  f.handlers['aiAssistant.chat'] = async () => ({ result: { code: 40001, message: '请缩短问题后再试' } });
  page.onAssistantInput({ detail: { value: '第一问' } });
  await page.onAssistantSend();
  assert.equal(page.data.assistantMessages.at(-1).content, '请缩短问题后再试');
  assert.equal(page.data.assistantReplying, false);
  f.handlers['aiAssistant.chat'] = async () => { throw new Error('private network detail'); };
  page.onAssistantInput({ detail: { value: '第二问' } });
  await page.onAssistantSend();
  assert.equal(page.data.assistantMessages.at(-1).content, 'AI助手暂时不可用，请稍后再试');
  assert.equal(page.data.assistantReplying, false);
});

for (const outcome of ['success', 'failure']) {
  test(`unloading home rejects a late assistant ${outcome} without changing the discarded conversation`, async t => {
    const f = fixture(t), response = deferred(), page = f.page;
    f.handlers['aiAssistant.chat'] = () => response.promise;
    tapAssistant(page);
    page.onAssistantInput({ detail: { value: '旧页面的问题' } });
    const sending = page.onAssistantSend();
    page.onUnload();
    const snapshot = structuredClone(page.data);
    if (outcome === 'success') response.resolve(ok({ content: '迟到的回答', products: [] }));
    else response.reject(new Error('late failure'));
    await sending;
    assert.deepEqual(page.data, snapshot);
    assert.equal(page.data.assistantOpen, false);
    assert.deepEqual(f.tabBar.map(item => item.method), ['hide', 'show']);
  });
}

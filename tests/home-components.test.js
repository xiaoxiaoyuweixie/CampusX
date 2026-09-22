const test = require('node:test');
const assert = require('node:assert/strict');

function componentFixture(t, name, properties = {}) {
  let definition;
  const originalComponent = global.Component;
  global.Component = value => { definition = value; };
  const file = require.resolve(`../miniprogram/components/${name}/index.js`);
  delete require.cache[file];
  require(file);
  global.Component = originalComponent;
  t.after(() => { delete require.cache[file]; });
  const events = [];
  return {
    events,
    component: {
      ...definition.methods,
      data: {
        ...Object.fromEntries(Object.entries(definition.properties).map(([key, value]) => [key, structuredClone(value.value)])),
        ...properties,
      },
      triggerEvent(...args) { events.push(args); },
    },
  };
}

test('home and category product cards emit the actual product identity without changing product content', t => {
  for (const variant of ['home', 'default']) {
    for (const ids of [
      { productId: 'business-id', _id: 'database-id', id: 'display-id' },
      { _id: 'database-id', id: 'display-id' },
      { id: 'display-id' },
    ]) {
      const product = Object.freeze({ ...ids, title: '真实商品长标题，保留用户输入的内容', cover: 'cloud://actual/cover',
        price: 123.45, campus: '真实交易校区', sellerName: '真实卖家', views: 678 });
      const { component, events } = componentFixture(t, 'product-card', { product, variant });
      component.onTap();
      assert.deepEqual(events, [['producttap', { id: ids.productId || ids._id || ids.id }, { bubbles: false, composed: false }]]);
      assert.equal(component.data.product, product);
    }
  }
});

test('a product card with no product identity does not emit a detail-navigation event', t => {
  const { component, events } = componentFixture(t, 'product-card');
  component.onTap();
  component.data.product = null;
  component.onTap();
  component.data.product = { title: '尚无标识的商品' };
  component.onTap();
  assert.deepEqual(events, []);
});

test('search input and keyboard confirmation preserve exact text and leave the controlled value to the page', t => {
  const { component, events } = componentFixture(t, 'search-bar', { value: '已加载的关键词' });
  component.onInput({ detail: { value: '  新教材 📚  ' } });
  component.onConfirm({ detail: { value: '  新教材 📚  ' } });
  component.onInput({ detail: { value: '' } });
  component.onConfirm({ detail: { value: '' } });
  assert.deepEqual(events, [
    ['input', { value: '  新教材 📚  ' }], ['confirm', { value: '  新教材 📚  ' }],
    ['input', { value: '' }], ['confirm', { value: '' }],
  ]);
  assert.equal(component.data.value, '已加载的关键词');
});

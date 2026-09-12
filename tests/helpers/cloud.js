const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '../..');
const clone = value => structuredClone(value);

function fixture() {
  let tables = {
    users: {
      buyer: { _id: 'buyer', openid: 'buyer', account: '220000000000001', status: 'enabled', nickname: '买家' },
      seller: { _id: 'seller', openid: 'seller', account: '220000000000002', status: 'enabled', nickname: '卖家',
        contacts: { wechat: { value: 'abcdef', enabled: true }, phone: { value: '001234', enabled: true } } },
      outsider: { _id: 'outsider', openid: 'outsider', status: 'enabled' },
    },
    products: { product: { _id: 'product', productId: 'P1', openid: 'seller', status: 'on_sale', title: '教材', images: [] } },
    chat_sessions: { session: { _id: 'session', sessionId: 'S1', productId: 'P1', buyerOpenid: 'buyer', sellerOpenid: 'seller',
      participants: ['buyer', 'seller'], status: 'active', unreadCount: { buyer: 0, seller: 0 }, lastMessage: {} } },
    chat_messages: {},
  };
  const state = { openid: 'buyer', beforeTransaction: null, failWrites: false, files: new Map() };
  const command = {
    inc: value => ({ op: 'inc', value }), set: value => ({ op: 'set', value }),
    all: value => ({ op: 'all', value }), in: value => ({ op: 'in', value }), or: value => ({ op: 'or', value }),
  };
  const field = (obj, key) => key.split('.').reduce((value, part) => value && value[part], obj);
  function matches(item, query) {
    if (query.op === 'or') return query.value.some(q => matches(item, q));
    return Object.entries(query).every(([key, expected]) => {
      const actual = field(item, key);
      if (expected && expected.op === 'all') return expected.value.every(value => (actual || []).includes(value));
      if (expected && expected.op === 'in') return expected.value.includes(actual);
      return actual === expected;
    });
  }
  function update(item, data) {
    if (state.failWrites) throw new Error('simulated database write failure');
    for (const [key, value] of Object.entries(data)) {
      const parts = key.split('.');
      let target = item;
      for (const part of parts.slice(0, -1)) target = target[part] || (target[part] = {});
      const last = parts[parts.length - 1];
      target[last] = value && value.op === 'inc' ? Number(target[last] || 0) + value.value
        : clone(value && value.op === 'set' ? value.value : value);
    }
  }
  function store(getTables) {
    return {
      collection(name) {
        const rows = () => getTables()[name] || (getTables()[name] = {});
        let query = {}, orders = [], skip = 0, limit = Infinity;
        const selected = () => {
          let list = Object.values(rows()).filter(item => matches(item, query));
          if (orders.length) list.sort((a, b) => {
            for (const [order, direction] of orders) {
              const delta = (a[order] > b[order] ? 1 : a[order] < b[order] ? -1 : 0) * (direction === 'desc' ? -1 : 1);
              if (delta) return delta;
            }
            return 0;
          });
          return list.slice(skip, skip + limit);
        };
        const api = {
          where(value) { query = value; return api; }, orderBy(key, dir) { orders.push([key, dir]); return api; },
          skip(value) { skip = value; return api; }, limit(value) { limit = value; return api; },
          async get() { return { data: clone(selected()) }; },
          async count() { return { total: Object.values(rows()).filter(item => matches(item, query)).length }; },
          async update({ data }) { selected().forEach(item => update(item, data)); return {}; },
          async add({ data }) { const id = `auto-${Object.keys(rows()).length}`; rows()[id] = { ...clone(data), _id: id }; return { _id: id }; },
          doc(id) {
            return {
              async get() { return { data: clone(rows()[id] || null) }; },
              async set({ data }) { if (state.failWrites) throw new Error('write failed'); rows()[id] = { ...clone(data), _id: id }; },
              async update({ data }) { if (!rows()[id]) throw new Error('document not found'); update(rows()[id], data); return {}; },
              async remove() { if (state.failWrites) throw new Error('write failed'); delete rows()[id]; return {}; },
            };
          },
        };
        return api;
      },
    };
  }
  let pending = Promise.resolve();
  const db = { ...store(() => tables), command, serverDate: () => new Date(),
    runTransaction(callback) {
      const result = pending.then(async () => {
        if (state.beforeTransaction) { const hook = state.beforeTransaction; state.beforeTransaction = null; await hook(); }
        const snapshot = clone(tables);
        const result = await callback(store(() => snapshot));
        tables = snapshot;
        return result;
      });
      pending = result.catch(() => {});
      return result;
    },
  };
  const cloud = {
    init() {}, DYNAMIC_CURRENT_ENV: 'test', database: () => db,
    getWXContext: () => ({ OPENID: state.openid, ENV: 'test' }),
    async downloadFile({ fileID }) { if (!state.files.has(fileID)) throw new Error('file missing'); return { fileContent: state.files.get(fileID) }; },
    async uploadFile({ cloudPath, fileContent }) { const fileID = `cloud://test.bucket/${cloudPath}`; state.files.set(fileID, fileContent); return { fileID }; },
    async deleteFile({ fileList }) { for (const fileID of fileList) state.files.delete(fileID); return { fileList: fileList.map(fileID => ({ fileID, status: 0 })) }; },
    async getTempFileURL({ fileList }) { return { fileList: fileList.map(item => ({ fileID: item.fileID, status: 0, tempFileURL: `https://test.invalid/${encodeURIComponent(item.fileID)}` })) }; },
  };
  const cache = new Map();
  function load(filename) {
    const file = require.resolve(path.isAbsolute(filename) ? filename : path.resolve(root, filename));
    if (cache.has(file)) return cache.get(file).exports;
    const module = new Module(file);
    module.filename = file;
    module.paths = Module._nodeModulePaths(path.dirname(file));
    cache.set(file, module);
    module.require = name => name === 'wx-server-sdk' ? cloud : name.startsWith('.') ? load(path.resolve(path.dirname(file), name)) : Module.createRequire(file)(name);
    module._compile(fs.readFileSync(file, 'utf8'), file);
    return module.exports;
  }
  const chat = load('cloudfunctions/chatService/index.js');
  const user = load('cloudfunctions/user/index.js');
  return { state, db, cloud, tables: () => tables, load,
    chat: (action, data = {}) => chat.main({ action, data }), user: (action, data = {}) => user.main({ action, data }) };
}
module.exports = { fixture };

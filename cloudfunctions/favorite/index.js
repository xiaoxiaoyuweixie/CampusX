const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ok = (data = null, message = 'success') => ({ code: 0, message, data });
const fail = (message = 'error', code = 50000, data = null) => ({ code, message, data });
const now = () => new Date().toISOString();
const getUid = (context, event) => event.userId || context.OPENID || context.openid || '';
const parsePagination = (event = {}) => {
  const page = Math.max(Number(event.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(event.pageSize || 10), 1), 50);
  return { page, pageSize, skip: (page - 1) * pageSize };
};

exports.main = async (event, context) => {
  try {
    const { action, data = {} } = event;
    const uid = getUid(context, event);
    const col = db.collection('favorites');
    if (!uid) return fail('unauthorized', 40004);

    if (action === 'addFavorite') {
      const exists = await col.where({ userId: uid, productId: data.productId }).count();
      if (!exists.total) await col.add({ data: { userId: uid, productId: data.productId, createdAt: now() } });
      return ok(true);
    }

    if (action === 'removeFavorite') {
      await col.where({ userId: uid, productId: data.productId }).remove();
      return ok(true);
    }

    if (action === 'listFavorites') {
      const { page, pageSize, skip } = parsePagination(data);
      const favoritesRes = await col.where({ userId: uid }).skip(skip).limit(pageSize).orderBy('createdAt', 'desc').get();
      const ids = favoritesRes.data.map(v => v.productId);
      const products = ids.length ? await db.collection('products').where({ _id: db.command.in(ids) }).get() : { data: [] };
      const total = (await col.where({ userId: uid }).count()).total;
      return ok({ list: products.data, page, pageSize, total });
    }

    if (action === 'checkFavorite') {
      const exists = await col.where({ userId: uid, productId: data.productId }).count();
      return ok({ favorited: exists.total > 0 });
    }

    return fail('unsupported action', 40001);
  } catch (err) { return fail(err.message); }
};

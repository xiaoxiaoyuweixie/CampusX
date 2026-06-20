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
    const col = db.collection('products');

    if (action === 'createProduct') {
      if (!uid) return fail('unauthorized', 40004);
      const payload = {
        userId: uid,
        title: data.title || '',
        desc: data.desc || '',
        price: Number(data.price || 0),
        category: data.category || '',
        images: data.images || [],
        cover: data.cover || (data.images && data.images[0]) || '',
        campus: data.campus || '',
        location: data.location || '',
        views: 0,
        status: data.status || 'published',
        createdAt: now(),
      };
      const res = await col.add({ data: payload });
      return ok({ _id: res._id });
    }

    if (action === 'listProducts') {
      const { page, pageSize, skip } = parsePagination(data);
      const query = {};
      if (data.category) query.category = data.category;
      if (data.campus) query.campus = data.campus;
      if (data.status) query.status = data.status;
      if (data.excludeMine && uid) query.userId = db.command.neq(uid);
      if (data.keyword) query.title = db.RegExp({ regexp: data.keyword, options: 'i' });
      const total = (await col.where(query).count()).total;
      const list = await col.where(query).skip(skip).limit(pageSize).orderBy('createdAt', 'desc').get();
      return ok({ list: list.data, page, pageSize, total });
    }

    if (action === 'getProductDetail') {
      const res = await col.doc(data.id).get();
      return ok(res.data || null);
    }

    if (action === 'updateProduct') {
      if (!uid) return fail('unauthorized', 40004);
      const { id, updates = {} } = data;
      await col.doc(id).update({ data: { ...updates, updatedAt: now() } });
      return ok(true);
    }

    if (action === 'deleteProduct') {
      if (!uid) return fail('unauthorized', 40004);
      await col.doc(data.id).update({ data: { status: 'offline', updatedAt: now() } });
      return ok(true);
    }

    if (action === 'getMyProducts') {
      if (!uid) return fail('unauthorized', 40004);
      const { page, pageSize, skip } = parsePagination(data);
      const query = { userId: uid };
      if (data.status) query.status = data.status;
      const total = (await col.where(query).count()).total;
      const list = await col.where(query).skip(skip).limit(pageSize).orderBy('createdAt', 'desc').get();
      return ok({ list: list.data, page, pageSize, total });
    }

    return fail('unsupported action', 40001);
  } catch (err) { return fail(err.message); }
};
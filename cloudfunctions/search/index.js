const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ok = (data = null, message = 'success') => ({ code: 0, message, data });
const fail = (message = 'error', code = 50000, data = null) => ({ code, message, data });
const parsePagination = (event = {}) => {
  const page = Math.max(Number(event.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(event.pageSize || 10), 1), 50);
  return { page, pageSize, skip: (page - 1) * pageSize };
};

exports.main = async (event) => {
  try {
    const { action, data = {} } = event;
    if (action !== 'search') return fail('unsupported action', 40001);
    const { page, pageSize, skip } = parsePagination(data);
    const keyword = data.keyword || '';
    const query = keyword ? { title: db.RegExp({ regexp: keyword, options: 'i' }) } : {};
    const total = (await db.collection('products').where(query).count()).total;
    const list = await db.collection('products').where(query).skip(skip).limit(pageSize).orderBy('createdAt', 'desc').get();
    return ok({ list: list.data, page, pageSize, total });
  } catch (err) { return fail(err.message); }
};

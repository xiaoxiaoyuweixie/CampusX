const { db } = require('../lib/cloud');
const { parsePagination } = require('../lib/pagination');
const { fail, ok } = require('../lib/response');
const { now } = require('../lib/time');

async function listProducts(data = {}) {
  const { page, pageSize, skip } = parsePagination(data);
  const query = {};
  if (data.status) query.status = data.status;
  if (data.categoryId) query.categoryId = data.categoryId;
  if (data.keyword) query.title = db.RegExp({ regexp: String(data.keyword), options: 'i' });

  const total = (await db.collection('products').where(query).count()).total;
  const res = await db.collection('products')
    .where(query)
    .orderBy('updatedAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get();

  return ok({ list: res.data, page, pageSize, total });
}

async function findProductDocId(id) {
  if (!id) return '';
  try {
    const doc = await db.collection('products').doc(id).get();
    if (doc.data && doc.data._id) return doc.data._id;
  } catch (err) {}

  const res = await db.collection('products').where({ productId: id }).limit(1).get();
  return res.data[0] ? res.data[0]._id : '';
}

async function updateProductStatus(data = {}) {
  const status = data.status;
  if (!['on_sale', 'off_shelf', 'sold'].includes(status)) return fail('invalid_product_status', 40001);

  const docId = await findProductDocId(data.id || data.productId);
  if (!docId) return fail('product_not_found', 40400);

  await db.collection('products').doc(docId).update({
    data: { status, updatedAt: now() },
  });
  return ok(true);
}

module.exports = { listProducts, updateProductStatus };

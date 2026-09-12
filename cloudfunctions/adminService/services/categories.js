const { db } = require('../lib/cloud');
const { parsePagination } = require('../lib/pagination');
const { fail, ok } = require('../lib/response');
const { now } = require('../lib/time');

async function listCategories(data = {}) {
  const { page, pageSize, skip } = parsePagination(data);
  const query = {};
  if (data.status) query.status = data.status;
  const total = (await db.collection('categories').where(query).count()).total;
  const res = await db.collection('categories')
    .where(query)
    .orderBy('sort', 'asc')
    .skip(skip)
    .limit(pageSize)
    .get();
  return ok({ list: res.data, page, pageSize, total });
}

async function findCategoryDocId(id) {
  if (!id) return '';
  try {
    const doc = await db.collection('categories').doc(id).get();
    if (doc.data && doc.data._id) return doc.data._id;
  } catch (err) {}

  const res = await db.collection('categories').where({
    categoryId: id,
  }).limit(1).get();
  return res.data[0] ? res.data[0]._id : '';
}

async function updateCategory(data = {}) {
  const docId = await findCategoryDocId(data.id || data.categoryId);
  if (!docId) return fail('category_not_found', 40400);

  const updates = {};
  ['name', 'icon', 'description', 'status'].forEach(key => {
    if (typeof data[key] === 'string') updates[key] = data[key].trim();
  });
  if (data.sort !== undefined) updates.sort = Number(data.sort) || 0;
  if (!Object.keys(updates).length) return fail('empty_category_update', 40001);
  updates.updatedAt = now();

  await db.collection('categories').doc(docId).update({ data: updates });
  return ok(true);
}

module.exports = { listCategories, updateCategory };

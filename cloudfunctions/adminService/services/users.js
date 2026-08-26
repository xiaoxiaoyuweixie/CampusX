const { db } = require('../lib/cloud');
const { parsePagination } = require('../lib/pagination');
const { fail, ok } = require('../lib/response');
const { now } = require('../lib/time');

async function listUsers(data = {}) {
  const { page, pageSize, skip } = parsePagination(data);
  const query = {};
  if (data.status) query.status = data.status;
  if (data.keyword) {
    query.nickname = db.RegExp({ regexp: String(data.keyword), options: 'i' });
  }

  const total = (await db.collection('users').where(query).count()).total;
  const res = await db.collection('users')
    .where(query)
    .orderBy('updatedAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get();

  return ok({ list: res.data, page, pageSize, total });
}

async function updateUserStatus(data = {}) {
  const id = data.id || data._id;
  const status = data.status;
  if (!id || !['enabled', 'disabled'].includes(status)) return fail('invalid_user_status', 40001);

  await db.collection('users').doc(id).update({
    data: { status, updatedAt: now() },
  });
  return ok(true);
}

module.exports = { listUsers, updateUserStatus };

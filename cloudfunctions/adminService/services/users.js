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

  const list = res.data.map(user => {
    const { contacts, ...publicUser } = user;
    return publicUser;
  });
  return ok({ list, page, pageSize, total });
}

async function getUserDetail(data = {}) {
  if (typeof data.id !== 'string' || !data.id.trim()) return fail('请选择要查看的用户', 40001);
  try {
    const res = await db.collection('users').where({ _id: data.id }).limit(1).get();
    const user = res.data[0];
    if (!user) return fail('用户不存在或已被删除', 40400);
    const contacts = user.contacts || {};
    const contact = type => ({
      value: typeof contacts[type]?.value === 'string' ? contacts[type].value : '',
      enabled: contacts[type]?.enabled === true,
    });
    return ok({
      _id: user._id,
      nickname: user.nickname || '',
      account: user.account || '',
      gender: user.gender || '未知',
      bio: user.bio || '',
      status: user.status || 'enabled',
      updatedAt: user.updatedAt || user.createdAt || null,
      contacts: { wechat: contact('wechat'), phone: contact('phone') },
    });
  } catch (err) {
    return fail('用户信息加载失败，请稍后重试', 50000);
  }
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

module.exports = { listUsers, getUserDetail, updateUserStatus };

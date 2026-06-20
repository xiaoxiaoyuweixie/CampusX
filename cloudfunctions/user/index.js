const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ok = (data = null, message = 'success') => ({ code: 0, message, data });
const fail = (message = 'error', code = 50000, data = null) => ({ code, message, data });
const now = () => new Date().toISOString();
const getUid = (context, event) => event.userId || context.OPENID || context.openid || '';

exports.main = async (event, context) => {
  try {
    const { action, data = {} } = event;
    const uid = getUid(context, event);
    const users = db.collection('users');

    if (!uid) return fail('unauthorized', 40004);

    if (action === 'getUserInfo') {
      const res = await users.where({ openid: uid }).limit(1).get();
      return ok(res.data[0] || null);
    }

    if (action === 'updateUserInfo') {
      const { nickname, avatar, gender, bio, school } = data;
      await users.where({ openid: uid }).update({ data: { nickname, avatar, gender, bio, school, updatedAt: now() } });
      return ok(true);
    }

    if (action === 'getDashboard') {
      const userRes = await users.where({ openid: uid }).limit(1).get();
      const user = userRes.data[0];
      const publishedCount = (await db.collection('products').where({ userId: uid, status: 'published' }).count()).total;
      const offlineCount = (await db.collection('products').where({ userId: uid, status: 'offline' }).count()).total;
      const favoriteCount = (await db.collection('favorites').where({ userId: uid }).count()).total;
      return ok({ user, publishedCount, offlineCount, favoriteCount });
    }

    return fail('unsupported action', 40001);
  } catch (err) { return fail(err.message); }
};
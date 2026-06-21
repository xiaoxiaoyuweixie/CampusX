const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const DEFAULT_AVATAR = 'cloud://cloud1-d6g5stkeb92288dee.636c-cloud1-d6g5stkeb92288dee-1445397435/system/default-avatar.png';

const ok = (data = null, message = 'success') => ({ code: 0, message, data });
const fail = (message = 'error', code = 50000, data = null) => ({ code, message, data });
const now = () => new Date().toISOString();
const getUid = (context, event) => event.userId || context.OPENID || context.openid || '';
const createDefaultNickname = () => `用户${Math.floor(100000 + Math.random() * 900000)}`;
const normalizeUser = (user = {}) => {
  const isDefaultNickname = typeof user.isDefaultNickname === 'boolean' ? user.isDefaultNickname : !user.nickname;
  const nickname = user.nickname || createDefaultNickname();
  const avatar = user.avatar || DEFAULT_AVATAR;
  return { ...user, nickname, avatar, isDefaultNickname };
};

exports.main = async (event, context) => {
  try {
    const { action, data = {} } = event;
    const uid = getUid(context, event);
    const users = db.collection('users');

    if (!uid) return fail('unauthorized', 40004);

    if (action === 'getUserInfo') {
      const res = await users.where({ openid: uid }).limit(1).get();
      const user = normalizeUser(res.data[0] || {});
      return ok(user);
    }

    if (action === 'updateUserInfo') {
      const { nickname, avatar, gender, bio, school } = data;
      if (!nickname) return fail('nickname不能为空', 40001);

      const updateData = {
        nickname,
        avatar: avatar || DEFAULT_AVATAR,
        gender,
        bio,
        school,
        isDefaultNickname: false,
        updatedAt: now(),
      };

      await users.where({ openid: uid }).update({ data: updateData });
      return ok(true);
    }

    if (action === 'getDashboard') {
      const userRes = await users.where({ openid: uid }).limit(1).get();
      const user = normalizeUser(userRes.data[0] || {});
      const publishedCount = (await db.collection('products').where({ userId: uid, status: 'published' }).count()).total;
      const offlineCount = (await db.collection('products').where({ userId: uid, status: 'offline' }).count()).total;
      const favoriteCount = (await db.collection('favorites').where({ userId: uid }).count()).total;
      return ok({ user, publishedCount, offlineCount, favoriteCount });
    }

    return fail('unsupported action', 40001);
  } catch (err) { return fail(err.message); }
};
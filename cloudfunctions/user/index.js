const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const DEFAULT_AVATAR = 'cloud://cloud1-d6g5stkeb92288dee.636c-cloud1-d6g5stkeb92288dee-1445397435/system/default-avatar.png';

function ok(data = null, message = 'success') {
  return { code: 0, message, data };
}

function fail(message = 'error', code = 50000, data = null) {
  return { code, message, data };
}

function now() {
  return db.serverDate();
}

function getOpenid() {
  const wxContext = cloud.getWXContext();
  return wxContext.OPENID;
}

function normalizeUser(user) {
  if (!user) return null;
  return {
    _id: user._id,
    openid: user.openid,
    account: user.account,
    avatar: user.avatar || DEFAULT_AVATAR,
    nickname: user.nickname || '',
    bio: user.bio || '',
    gender: user.gender || '未知',
    school: user.school || '西南大学',
    verified: !!user.verified,
    logged: true,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  };
}

async function getCurrentUser(openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data[0] || null;
}

async function safeCount(collectionName, query) {
  try {
    const res = await db.collection(collectionName).where(query).count();
    return res.total || 0;
  } catch (err) {
    return 0;
  }
}

exports.main = async (event) => {
  try {
    const { action, data = {} } = event || {};
    const openid = getOpenid();
    if (!openid) return fail('unauthorized', 40004);

    const users = db.collection('users');
    const user = await getCurrentUser(openid);
    if (!user) return fail('用户不存在，请先登录', 40400);

    if (action === 'getUserInfo') {
      return ok(normalizeUser(user));
    }

    if (action === 'updateUserInfo' || action === 'updateProfile') {
      const updates = {};
      if (typeof data.avatar === 'string') updates.avatar = data.avatar.trim();
      if (typeof data.nickname === 'string') {
        const nickname = data.nickname.trim();
        if (!nickname) return fail('昵称不能为空', 40001);
        updates.nickname = nickname;
      }
      if (typeof data.bio === 'string') updates.bio = data.bio.trim();
      if (typeof data.gender === 'string') {
        const gender = data.gender.trim();
        if (!gender) return fail('性别不能为空', 40001);
        updates.gender = gender;
      }

      if (!Object.keys(updates).length) {
        return fail('没有可更新的资料', 40001);
      }

      updates.updatedAt = now();
      await users.doc(user._id).update({ data: updates });
      const latest = await users.doc(user._id).get();
      return ok(normalizeUser(latest.data));
    }

    if (action === 'getDashboard') {
      const publishedCount = await safeCount('products', { openid, status: 'on_sale' });
      const favoriteCount = await safeCount('favorites', { openid });
      return ok({
        user: normalizeUser(user),
        publishedCount,
        favoriteCount,
      });
    }

    return fail('unsupported action', 40001);
  } catch (err) {
    return fail(err.message || 'user service failed');
  }
};

const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const DEFAULT_PASSWORD = 'swu123456';
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

function isValidAccount(account) {
  return /^22\d{13}$/.test(String(account || ''));
}

function createDefaultNickname() {
  const suffix = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  return `用户${suffix}`;
}

function normalizeUser(user) {
  if (!user) return null;
  return {
    _id: user._id,
    openid: user.openid,
    account: user.account,
    avatar: user.avatar || DEFAULT_AVATAR,
    nickname: user.nickname || createDefaultNickname(),
    bio: user.bio || '',
    gender: user.gender || '未知',
    school: user.school || '西南大学',
    status: user.status || 'enabled',
    verified: !!user.verified,
    logged: true,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  };
}

exports.main = async (event) => {
  try {
    const { action, data = {} } = event || {};
    if (action !== 'login') return fail('unsupported action', 40001);

    const account = String(data.account || '').trim();
    const password = String(data.password || '');

    if (!isValidAccount(account)) {
      return fail('账号必须是以22开头的15位数字', 40001);
    }
    if (password !== DEFAULT_PASSWORD) {
      return fail('账号或密码错误', 40001);
    }

    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    if (!openid) return fail('无法获取用户 openid', 40004);

    const users = db.collection('users');
    const openidRes = await users.where({ openid }).limit(1).get();
    const existedByOpenid = openidRes.data[0];

    if (existedByOpenid) {
      if (existedByOpenid.account !== account) {
        return fail('当前微信用户已绑定其他账号', 40900);
      }
      if (existedByOpenid.status === 'disabled') {
        return fail('账号已被禁用，请联系管理员', 40003);
      }

      await users.doc(existedByOpenid._id).update({
        data: { lastLoginAt: now() },
      });

      return ok({
        token: openid,
        openid,
        isNewUser: false,
        user: normalizeUser({ ...existedByOpenid, lastLoginAt: now() }),
      });
    }

    const accountRes = await users.where({ account }).limit(1).get();
    if (accountRes.data[0]) {
      return fail('该账号已绑定其他微信用户', 40900);
    }

    const userData = {
      openid,
      account,
      avatar: DEFAULT_AVATAR,
      nickname: createDefaultNickname(),
      bio: '',
      gender: '未知',
      school: data.school || '西南大学',
      status: 'enabled',
      verified: false,
      createdAt: now(),
      updatedAt: now(),
      lastLoginAt: now(),
    };
    const addRes = await users.add({ data: userData });

    return ok({
      token: openid,
      openid,
      isNewUser: true,
      user: normalizeUser({ ...userData, _id: addRes._id }),
    });
  } catch (err) {
    return fail(err.message || 'login failed');
  }
};

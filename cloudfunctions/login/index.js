const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const DEFAULT_AVATAR = 'cloud://cloud1-d6g5stkeb92288dee.636c-cloud1-d6g5stkeb92288dee-1445397435/system/default-avatar.png';

const ok = (data = null, message = 'success') => ({ code: 0, message, data });
const fail = (message = 'error', code = 50000, data = null) => ({ code, message, data });
const now = () => new Date().toISOString();
const createDefaultNickname = () => `用户${Math.floor(100000 + Math.random() * 900000)}`;
const ensureNickname = (nickname, isDefaultNickname) => {
  if (nickname) return { nickname, isDefaultNickname: !!isDefaultNickname };
  return { nickname: createDefaultNickname(), isDefaultNickname: true };
};
const ensureAvatar = (avatar) => avatar || DEFAULT_AVATAR;

exports.main = async (event, context) => {
  try {
    const { action, data = {} } = event;
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID || context.OPENID || '';
    const { account = '', password = '' } = data;

    if (action !== 'login') return fail('unsupported action', 40001);
    if (!openid) return fail('missing openid', 40001);

    const users = db.collection('users');
    if (!account || !password) {
      return fail('请输入账号和密码', 40001);
    }

    const userRes = await users.where({ account, password }).limit(1).get();
    const matchedUser = userRes.data[0];

    if (!matchedUser) {
      return fail('账号或密码错误', 40001);
    }

    const currentTime = now();
    const normalized = ensureNickname(matchedUser.nickname, matchedUser.isDefaultNickname);
    const nickname = normalized.nickname;
    const isDefaultNickname = normalized.isDefaultNickname;
    const avatar = ensureAvatar(matchedUser.avatar);

    await users.doc(matchedUser._id).update({
      data: {
        openid,
        nickname,
        avatar,
        isDefaultNickname,
        lastLoginAt: currentTime,
      },
    });

    return ok({
      openid,
      nickname,
      avatar,
      isDefaultNickname,
      createdAt: matchedUser.createdAt || currentTime,
      lastLoginAt: currentTime,
      userId: matchedUser._id,
    });
  } catch (err) {
    return fail(err.message);
  }
};
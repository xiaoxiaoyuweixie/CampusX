const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ok = (data = null, message = 'success') => ({ code: 0, message, data });
const fail = (message = 'error', code = 50000, data = null) => ({ code, message, data });
const now = () => new Date().toISOString();

exports.main = async (event, context) => {
  try {
    const { action, data = {} } = event;
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID || context.OPENID || '';
    const { account = '', password = '' } = data;

    if (action !== 'login') return fail('unsupported action', 40001);
    if (!openid) return fail('missing openid', 40001);
    if (!account || !password) return fail('请输入账号和密码', 40001);

    const users = db.collection('users');
    const accountRes = await users.where({ account }).limit(1).get();
    let user = accountRes.data[0];

    if (!user) {
      const res = await users.add({
        data: {
          openid,
          account,
          password,
          loginState: true,
          nickname: data.nickname || account,
          avatar: data.avatar || '',
          gender: data.gender || '',
          bio: data.bio || '',
          school: data.school || '西南大学',
          verified: false,
          createdAt: now(),
          lastLoginAt: now(),
        },
      });
      user = { _id: res._id, openid, account, loginState: true, nickname: data.nickname || account };
      return ok({ token: openid, openid, isNewUser: true, user });
    }

    if (user.password !== password) {
      return fail('账号或密码错误', 40001);
    }

    await users.doc(user._id).update({ data: { openid, loginState: true, lastLoginAt: now() } });
    user.loginState = true;
    return ok({ token: openid, openid, isNewUser: false, user });
  } catch (err) {
    return fail(err.message);
  }
};
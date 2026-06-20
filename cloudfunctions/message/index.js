const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ok = (data = null, message = 'success') => ({ code: 0, message, data });
const fail = (message = 'error', code = 50000, data = null) => ({ code, message, data });
const getUid = (context, event) => event.userId || context.OPENID || context.openid || '';

exports.main = async (event, context) => {
  try {
    const { action } = event;
    const uid = getUid(context, event);
    if (!uid) return fail('unauthorized', 40004);

    if (action === 'systemNoticeList') {
      const list = await db.collection('system_notice').orderBy('createdAt', 'desc').get();
      return ok(list.data);
    }

    if (action === 'unreadCount') {
      return ok({ system: 0, chat: 0, total: 0 });
    }

    return fail('unsupported action', 40001);
  } catch (err) { return fail(err.message); }
};

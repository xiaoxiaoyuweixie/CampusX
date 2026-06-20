const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const ok = (data = null, message = 'success') => ({ code: 0, message, data });
const fail = (message = 'error', code = 50000, data = null) => ({ code, message, data });
const getUid = (context, event) => event.userId || context.OPENID || context.openid || '';

exports.main = async (event, context) => {
  try {
    const { action, data = {} } = event;
    const uid = getUid(context, event);
    if (!uid) return fail('unauthorized', 40004);

    if (action === 'getUploadPath') {
      const ext = data.ext || 'jpg';
      const cloudPath = `products/${uid}/${Date.now()}.${ext}`;
      return ok({ cloudPath });
    }

    if (action === 'getUploadToken') {
      return ok({ note: 'use wx.cloud.uploadFile with cloudPath' });
    }

    return fail('unsupported action', 40001);
  } catch (err) { return fail(err.message); }
};

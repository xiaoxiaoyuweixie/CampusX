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
    const sessionCol = db.collection('chat_sessions');
    const msgCol = db.collection('chat_messages');
  const userB = String(b || '');
  return {
    $or: [
      { userA, userB, productId },
      { userA: userB, userB: userA, productId },
    ],
  };
}

exports.main = async (event, context) => {
  try {
    const { action, data = {} } = event;
    const uid = getUid(context, event);
    const sessionCol = db.collection('chat_sessions');
    const msgCol = db.collection('chat_messages');
    if (!uid && action !== 'getMessages') return fail('unauthorized', 40004);

    if (action === 'createSession') {
      const { userA, userB, productId } = data;
      const existed = await sessionCol.where({
        userA: db.command.in([userA, userB]),
        userB: db.command.in([userA, userB]),
        productId,
      }).limit(1).get();
      if (existed.data[0]) return ok(existed.data[0]);
      const res = await sessionCol.add({ data: { userA, userB, productId, lastMessage: '', updatedAt: now() } });
      return ok({ _id: res._id });
    }

    if (action === 'getSessionList') {
      const list = await sessionCol.where(db.command.or([{ userA: uid }, { userB: uid }])).orderBy('updatedAt', 'desc').get();
      return ok(list.data);
    }

    if (action === 'getMessages') {
      const list = await msgCol.where({ sessionId: data.sessionId }).orderBy('createdAt', 'asc').get();
      return ok(list.data);
    }

    if (action === 'sendMessage') {
      const res = await msgCol.add({ data: { sessionId: data.sessionId, fromUser: uid, toUser: data.toUser, text: data.text, createdAt: now() } });
      await sessionCol.doc(data.sessionId).update({ data: { lastMessage: data.text, updatedAt: now() } });
      return ok({ _id: res._id });
    }

    return fail('unsupported action', 40001);
  } catch (err) { return fail(err.message); }
};

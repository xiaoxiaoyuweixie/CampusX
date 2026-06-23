const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const SESSION_STATUS = {
  ACTIVE: 'active',
};

const MESSAGE_TYPE = {
  TEXT: 'text',
};

const MESSAGE_STATUS = {
  SENT: 'sent',
};

const CONTACTABLE_PRODUCT_STATUS = ['on_sale', 'sold'];

function ok(data = null, message = 'success') {
  return { code: 0, message, data };
}

function fail(message = 'error', code = 50000, data = null) {
  return { code, message, data };
}

function now() {
  return new Date();
}

function getOpenid() {
  return cloud.getWXContext().OPENID;
}

function createBusinessId(prefix) {
  const d = new Date();
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  const stamp = [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
    pad(d.getHours()),
    pad(d.getMinutes()),
    pad(d.getSeconds()),
  ].join('');
  return `${prefix}${stamp}${pad(Math.floor(Math.random() * 10000), 4)}`;
}

function parsePagination(data = {}) {
  const page = Math.max(Number(data.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(data.pageSize || 20), 1), 50);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function formatTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const nowDate = new Date();
  const pad = n => String(n).padStart(2, '0');
  if (date.toDateString() === nowDate.toDateString()) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function userSnapshot(user = {}) {
  return {
    nickname: user.nickname || 'Campus user',
    avatar: user.avatar || '',
  };
}

function latestUserSnapshot(user = {}) {
  const snapshot = {};
  if (user.nickname) snapshot.nickname = user.nickname;
  if (user.avatar) snapshot.avatar = user.avatar;
  return snapshot;
}

function isDisabledUser(user) {
  return user && user.status === 'disabled';
}

function getSessionKey(session = {}, fallback = '') {
  return session.sessionId || fallback || session._id || '';
}

function normalizeUnreadCount(unreadCount = {}) {
  return {
    buyer: Number(unreadCount.buyer || 0),
    seller: Number(unreadCount.seller || 0),
  };
}

function assertParticipant(session, openid) {
  return Array.isArray(session.participants) && session.participants.includes(openid);
}

function getRole(session, openid) {
  return session.buyerOpenid === openid ? 'buyer' : 'seller';
}

function getPeerRole(role) {
  return role === 'buyer' ? 'seller' : 'buyer';
}

function getPeerOpenid(session = {}, openid) {
  return session.buyerOpenid === openid ? session.sellerOpenid : session.buyerOpenid;
}

function getPeerSnapshot(session = {}, peerRole) {
  return peerRole === 'buyer' ? session.buyerSnapshot : session.sellerSnapshot;
}

function normalizeMessage(message = {}, openid) {
  return {
    ...message,
    id: message.messageId || message._id,
    from: message.senderOpenid === openid ? 'me' : 'other',
    text: message.content || '',
    time: formatTime(message.createdTimestamp || message.createdAt),
  };
}

function normalizeSession(session = {}, openid, latestPeer = null) {
  const role = getRole(session, openid);
  const peerRole = getPeerRole(role);
  const peerSnapshot = {
    ...(getPeerSnapshot(session, peerRole) || {}),
    ...(latestPeer ? latestUserSnapshot(latestPeer) : {}),
  };
  const unreadCount = normalizeUnreadCount(session.unreadCount);
  const unread = role === 'buyer' ? unreadCount.buyer : unreadCount.seller;
  const lastMessageText = session.lastMessage && session.lastMessage.content
    ? session.lastMessage.content
    : 'No messages yet';

  return {
    ...session,
    id: session.sessionId || session._id,
    name: (peerSnapshot && peerSnapshot.nickname) || 'Campus user',
    avatar: (peerSnapshot && peerSnapshot.avatar) || '',
    productTitle: session.productTitle || '',
    productCover: session.productCover || '',
    lastMessageText,
    lastMessage: lastMessageText,
    unread,
    time: formatTime(
      (session.lastMessage && (session.lastMessage.createdTimestamp || session.lastMessage.createdAt))
      || session.updatedAt
    ),
    role,
    peerRole,
  };
}

async function getCurrentUser(openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data[0] || null;
}

async function getUsersByOpenids(openids = []) {
  const uniqueOpenids = [...new Set(openids.filter(Boolean))];
  if (!uniqueOpenids.length) return {};

  const res = await db.collection('users').where({
    openid: _.in(uniqueOpenids),
  }).get();

  return (res.data || []).reduce((map, user) => {
    if (user.openid) map[user.openid] = user;
    return map;
  }, {});
}

async function normalizeSessionsWithLatestUsers(sessionList = [], openid) {
  const peerOpenids = sessionList.map(session => getPeerOpenid(session, openid));
  const userMap = await getUsersByOpenids(peerOpenids);

  return sessionList.map(session => {
    const peerOpenid = getPeerOpenid(session, openid);
    return normalizeSession(session, openid, userMap[peerOpenid] || null);
  });
}

async function findProduct(productId) {
  if (!productId) return null;
  const byProductId = await db.collection('products').where({ productId }).limit(1).get();
  if (byProductId.data[0]) return byProductId.data[0];

  try {
    const byDocId = await db.collection('products').doc(productId).get();
    return byDocId.data || null;
  } catch (err) {
    return null;
  }
}

async function findSessionById(sessionId) {
  if (!sessionId) return null;
  const bySessionId = await db.collection('chat_sessions').where({ sessionId }).limit(1).get();
  if (bySessionId.data[0]) return bySessionId.data[0];

  try {
    const byDocId = await db.collection('chat_sessions').doc(sessionId).get();
    return byDocId.data || null;
  } catch (err) {
    return null;
  }
}

async function updateSession(session, data, fallbackSessionId = '') {
  const sessionKey = getSessionKey(session, fallbackSessionId);
  const updateData = { ...data };

  if (!session.sessionId && sessionKey) {
    updateData.sessionId = sessionKey;
  }

  if (session._id) {
    await db.collection('chat_sessions').doc(session._id).update({ data: updateData });
    return { success: true, via: 'docId', sessionKey };
  }

  if (!sessionKey) {
    return { success: false, via: 'none', reason: 'missing_session_key' };
  }

  const sessionRes = await db.collection('chat_sessions').where({ sessionId: sessionKey }).limit(1).get();
  const latestSession = sessionRes.data[0];
  if (!latestSession || !latestSession._id) {
    return { success: false, via: 'sessionId', reason: 'session_not_found', sessionKey };
  }

  await db.collection('chat_sessions').doc(latestSession._id).update({ data: updateData });
  return { success: true, via: 'sessionId', sessionKey };
}

async function openSession(data, openid) {
  const currentUser = await getCurrentUser(openid);
  if (!currentUser) return fail('user_not_found', 40004);
  if (isDisabledUser(currentUser)) return fail('账号已被禁用，请联系管理员', 40003);

  const product = await findProduct(data.productId);
  if (!product) return fail('product_not_found', 40400);
  if (!CONTACTABLE_PRODUCT_STATUS.includes(product.status)) {
    return fail('product_not_contactable', 40001);
  }
  if (!product.openid) return fail('seller_missing', 40001);
  if (product.openid === openid) return fail('cannot_contact_self', 40003);

  const buyerOpenid = openid;
  const sellerOpenid = product.openid;
  const productId = product.productId || product._id;
  const sessions = db.collection('chat_sessions');
  const existing = await sessions.where({ productId, buyerOpenid, sellerOpenid }).limit(1).get();

  if (existing.data[0]) {
    const session = existing.data[0];
    const sessionId = getSessionKey(session);
    if (!session.sessionId && sessionId) {
      await updateSession(session, {}, sessionId);
    }
    const normalizedList = await normalizeSessionsWithLatestUsers([{ ...session, sessionId }], openid);
    return ok({ session: normalizedList[0], sessionId });
  }

  const [buyer, seller] = await Promise.all([
    Promise.resolve(currentUser),
    getCurrentUser(sellerOpenid),
  ]);

  const sessionId = createBusinessId('S');
  const createdAt = now();
  const payload = {
    sessionId,
    productId,
    productTitle: product.title || '',
    productCover: product.cover || (Array.isArray(product.images) ? product.images[0] : '') || '',
    buyerOpenid,
    buyerUserId: (buyer && (buyer.userId || buyer.account)) || buyerOpenid,
    sellerOpenid,
    sellerUserId: (seller && (seller.userId || seller.account)) || sellerOpenid,
    participants: [buyerOpenid, sellerOpenid],
    buyerSnapshot: userSnapshot(buyer || {}),
    sellerSnapshot: userSnapshot(seller || {
      nickname: product.sellerName || 'Seller',
      avatar: product.sellerAvatar || '',
    }),
    lastMessage: {},
    unreadCount: { buyer: 0, seller: 0 },
    status: SESSION_STATUS.ACTIVE,
    createdAt,
    updatedAt: createdAt,
  };

  const addRes = await sessions.add({ data: payload });
  const session = { ...payload, _id: addRes._id };
  return ok({ session: normalizeSession(session, openid), sessionId });
}

async function sendMessage(data, openid) {
  const currentUser = await getCurrentUser(openid);
  if (!currentUser) return fail('user_not_found', 40004);
  if (isDisabledUser(currentUser)) return fail('账号已被禁用，请联系管理员', 40003);

  const content = String(data.content || data.text || '').trim();
  if (!content) return fail('empty_content', 40001);
  if (content.length > 500) return fail('content_too_long', 40001);

  const session = await findSessionById(data.sessionId);
  if (!session) return fail('session_not_found', 40400, { inputSessionId: data.sessionId || '' });
  if (!assertParticipant(session, openid)) {
    return fail('not_session_participant', 40003, {
      inputSessionId: data.sessionId || '',
      openid,
      participants: session.participants || [],
    });
  }

  const role = getRole(session, openid);
  const peerRole = getPeerRole(role);
  const receiverOpenid = role === 'buyer' ? session.sellerOpenid : session.buyerOpenid;
  const sessionKey = getSessionKey(session, data.sessionId);
  const messageId = createBusinessId('M');
  const createdAt = now();
  const createdTimestamp = createdAt.getTime();
  const unreadCount = normalizeUnreadCount(session.unreadCount);
  unreadCount[peerRole] += 1;
  const lastMessage = {
    content,
    type: MESSAGE_TYPE.TEXT,
    senderOpenid: openid,
    createdAt,
    createdTimestamp,
  };

  const sessionUpdateResult = await updateSession(session, {
    lastMessage: _.set(lastMessage),
    unreadCount,
    updatedAt: createdAt,
  }, data.sessionId);

  if (!sessionUpdateResult.success) {
    return fail('session_update_failed', 50001, sessionUpdateResult);
  }

  const messagePayload = {
    messageId,
    sessionId: sessionKey,
    productId: session.productId,
    senderOpenid: openid,
    receiverOpenid,
    senderRole: role,
    type: MESSAGE_TYPE.TEXT,
    content,
    status: MESSAGE_STATUS.SENT,
    createdAt,
    createdTimestamp,
  };

  await db.collection('chat_messages').add({ data: messagePayload });
  return ok({ message: normalizeMessage(messagePayload, openid), messageId, sessionUpdateResult });
}

async function getMessages(data, openid) {
  const currentUser = await getCurrentUser(openid);
  if (!currentUser) return fail('user_not_found', 40004);
  if (isDisabledUser(currentUser)) return fail('账号已被禁用，请联系管理员', 40003);

  const session = await findSessionById(data.sessionId);
  if (!session) return fail('session_not_found', 40400, { inputSessionId: data.sessionId || '' });
  if (!assertParticipant(session, openid)) return fail('not_session_participant', 40003);

  const { page, pageSize, skip } = parsePagination(data);
  const sessionKey = getSessionKey(session, data.sessionId);
  const messageRes = await db.collection('chat_messages')
    .where({ sessionId: sessionKey })
    .orderBy('createdTimestamp', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get();
  const total = (await db.collection('chat_messages').where({ sessionId: sessionKey }).count()).total;
  const role = getRole(session, openid);
  const unreadCount = normalizeUnreadCount(session.unreadCount);
  unreadCount[role] = 0;
  await updateSession(session, { unreadCount }, data.sessionId);
  const peerOpenid = getPeerOpenid(session, openid);
  const userMap = await getUsersByOpenids([peerOpenid]);

  return ok({
    list: messageRes.data.reverse().map(item => normalizeMessage(item, openid)),
    session: normalizeSession(session, openid, userMap[peerOpenid] || null),
    page,
    pageSize,
    total,
  });
}

async function getSessionList(data, openid) {
  const currentUser = await getCurrentUser(openid);
  if (!currentUser) return fail('user_not_found', 40004);
  if (isDisabledUser(currentUser)) return fail('账号已被禁用，请联系管理员', 40003);

  const { page, pageSize, skip } = parsePagination(data);
  const query = { participants: _.all([openid]), status: SESSION_STATUS.ACTIVE };
  const total = (await db.collection('chat_sessions').where(query).count()).total;
  const sessionRes = await db.collection('chat_sessions')
    .where(query)
    .orderBy('updatedAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get();
  const list = await normalizeSessionsWithLatestUsers(sessionRes.data, openid);

  return ok({
    list,
    page,
    pageSize,
    total,
  });
}

async function markRead(data, openid) {
  const currentUser = await getCurrentUser(openid);
  if (!currentUser) return fail('user_not_found', 40004);
  if (isDisabledUser(currentUser)) return fail('账号已被禁用，请联系管理员', 40003);

  const session = await findSessionById(data.sessionId);
  if (!session) return fail('session_not_found', 40400, { inputSessionId: data.sessionId || '' });
  if (!assertParticipant(session, openid)) return fail('not_session_participant', 40003);

  const role = getRole(session, openid);
  const unreadCount = normalizeUnreadCount(session.unreadCount);
  unreadCount[role] = 0;
  await updateSession(session, { unreadCount }, data.sessionId);
  return ok(true);
}

exports.main = async (event = {}) => {
  try {
    const { action, data = {} } = event;
    const openid = getOpenid();
    if (!openid) return fail('unauthorized', 40004);

    if (action === 'openSession' || action === 'createSession') return openSession(data, openid);
    if (action === 'sendMessage') return sendMessage(data, openid);
    if (action === 'getMessages') return getMessages(data, openid);
    if (action === 'getSessionList') return getSessionList(data, openid);
    if (action === 'markRead') return markRead(data, openid);

    return fail('unsupported_action', 40001, { action });
  } catch (err) {
    return fail(err.message || 'chat_service_failed', 50000, {
      name: err.name || '',
      stack: err.stack || '',
    });
  }
};

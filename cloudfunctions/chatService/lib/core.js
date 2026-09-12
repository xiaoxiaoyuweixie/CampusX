const cloud = require('wx-server-sdk');
const crypto = require('crypto');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const command = db.command;

class BusinessError extends Error {
  constructor(message, code = 40003) { super(message); this.code = code; }
}
function reject(message, code) { throw new BusinessError(message, code); }
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function pagination(data = {}) {
  const page = Math.max(1, Math.floor(Number(data.page) || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(data.pageSize) || 50)));
  return { page, pageSize, skip: (page - 1) * pageSize };
}
async function doc(store, collection, id) {
  if (!id) return null;
  try { return (await store.collection(collection).doc(id).get()).data || null; }
  catch (err) {
    if (/DOCUMENT_NOT_FOUND|DATABASE_DOCUMENT_NOT_EXIST|document.*(not exist|not found)/i.test(`${err.code} ${err.message}`)) return null;
    throw err;
  }
}
async function find(collection, field, value) {
  if (typeof value !== 'string' || !value) return null;
  const result = await db.collection(collection).where({ [field]: value }).limit(1).get();
  return result.data[0] || (field === 'openid' ? null : doc(db, collection, value));
}
function assertUser(user) {
  if (!user) reject('请先登录', 40004);
  if (user.status === 'disabled') reject('账号已被禁用，请联系管理员');
}
function assertSession(session, openid) {
  if (!session) reject('会话不存在', 40400);
  if (!Array.isArray(session.participants) || !session.participants.includes(openid)
    || ![session.buyerOpenid, session.sellerOpenid].includes(openid)) reject('无权访问该会话');
}
function peerId(session, openid) {
  return session.buyerOpenid === openid ? session.sellerOpenid : session.buyerOpenid;
}
function sessionKey(session) { return session.sessionId || session._id; }
function snapshot(user = {}) { return { nickname: user.nickname || '校园用户', avatar: user.avatar || '' }; }
function formatTime(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return date.toDateString() === new Date().toDateString()
    ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function normalizeSession(session, openid, peer) {
  const role = session.buyerOpenid === openid ? 'buyer' : 'seller';
  const peerRole = role === 'buyer' ? 'seller' : 'buyer';
  const other = { ...(session[`${peerRole}Snapshot`] || {}), ...(peer ? snapshot(peer) : {}) };
  const last = session.lastMessage || {};
  return {
    id: sessionKey(session), sessionId: sessionKey(session), productId: session.productId,
    productTitle: session.productTitle || '', productCover: session.productCover || '',
    name: other.nickname || '校园用户', avatar: other.avatar || '', role, peerRole,
    lastMessage: last.type === 'image' ? '[图片]' : (last.content || '暂无消息'),
    lastMessageText: last.type === 'image' ? '[图片]' : (last.content || '暂无消息'),
    unread: Number((session.unreadCount || {})[role] || 0),
    time: formatTime(last.createdTimestamp || session.updatedAt),
  };
}
function normalizeMessage(message, openid) {
  return {
    id: message.messageId || message._id, clientMessageId: message.senderOpenid === openid ? message.clientMessageId || '' : '',
    from: message.senderOpenid === openid ? 'me' : 'other', type: message.type || 'text',
    text: message.content || '', createdTimestamp: message.createdTimestamp,
    time: formatTime(message.createdTimestamp || message.createdAt), status: 'sent',
    image: message.type === 'image' ? { width: (message.image || {}).width || 1, height: (message.image || {}).height || 1 } : null,
  };
}
async function context(sessionId, openid) {
  const user = await find('users', 'openid', openid);
  assertUser(user);
  const session = await find('chat_sessions', 'sessionId', sessionId);
  assertSession(session, openid);
  const peer = await find('users', 'openid', peerId(session, openid));
  const product = await find('products', 'productId', session.productId);
  // An old lastMessage snapshot alone does not prove successful message insertion.
  const result = await db.collection('chat_messages').where({ sessionId: sessionKey(session), status: 'sent' }).limit(1).get();
  return { user, session, peer, product, hasHistory: result.data.length > 0 };
}
function productReason(product) {
  return product && product.status === 'sold' ? '商品已售出，无法发起聊天' : '商品已下架，无法发起聊天';
}
function contactItem(peer, type) {
  const item = ((peer || {}).contacts || {})[type] || {};
  return { enabled: item.enabled === true, value: typeof item.value === 'string' ? item.value : '' };
}
function mask(value) {
  const chars = Array.from(value);
  return chars.length >= 4 ? `${chars.slice(0, 2).join('')}****${chars[chars.length - 1]}` : '****';
}
function permissions(ctx) {
  const { peer, product, hasHistory } = ctx;
  const peerReason = !peer || peer.status === 'disabled' ? '当前无法与该用户联系' : '';
  const onSale = !!product && product.status === 'on_sale';
  const sendReason = peerReason || (!onSale && !hasHistory ? productReason(product) : '');
  const contactReason = peerReason || (!onSale ? '商品已下架或已售出，无法获取联系方式' : '');
  const contact = type => {
    const item = contactItem(peer, type);
    const reason = contactReason || (!item.enabled || !item.value ? `对方暂未开放${type === 'wechat' ? '微信' : '电话'}联系方式` : '');
    return { available: !reason, reason, masked: !reason && type === 'wechat' ? mask(item.value) : '' };
  };
  return { canSend: !sendReason, sendReason, wechat: contact('wechat'), phone: contact('phone') };
}
async function freshContext(transaction, ctx, openid) {
  const user = await doc(transaction, 'users', ctx.user._id);
  assertUser(user);
  const session = await doc(transaction, 'chat_sessions', ctx.session._id);
  assertSession(session, openid);
  const peer = ctx.peer ? await doc(transaction, 'users', ctx.peer._id) : null;
  const product = ctx.product ? await doc(transaction, 'products', ctx.product._id) : null;
  return { user, session, peer, product, hasHistory: ctx.hasHistory || Number(session.messageCount) > 0 };
}
module.exports = { cloud, db, command, crypto, BusinessError, reject, hash, doc, find, assertUser, assertSession,
  peerId, sessionKey, snapshot, normalizeSession, normalizeMessage, context, permissions, contactItem, mask,
  freshContext, pagination, productReason };

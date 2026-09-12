const cloud = require('wx-server-sdk');
const crypto = require('crypto');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

class BusinessError extends Error {
  constructor(message, code = 400, data = null) { super(message); this.code = code; this.data = data; }
}
const reject = (message, code, data) => { throw new BusinessError(message, code, data); };
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const missing = () => reject('举报对象不存在或已被删除，无法提交举报', 404);
function identifier(value, label = '提交标识') {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{8,96}$/.test(value)) reject(`${label}无效，请重试`);
  return value;
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
  if (user.status === 'disabled') reject('账号已被禁用，请联系管理员', 403);
}
async function userContext(openid) {
  const user = await find('users', 'openid', openid);
  assertUser(user);
  return user;
}
function assertSession(session, openid) {
  if (!session) missing();
  if (!Array.isArray(session.participants) || !session.participants.includes(openid)
    || ![session.buyerOpenid, session.sellerOpenid].includes(openid)) reject('无权举报该会话', 403);
}
async function context(sessionId, openid, existingUser) {
  const user = existingUser || await userContext(openid);
  const session = await find('chat_sessions', 'sessionId', sessionId);
  assertSession(session, openid);
  const peerOpenid = session.buyerOpenid === openid ? session.sellerOpenid : session.buyerOpenid;
  if (!peerOpenid || peerOpenid === openid) reject('无权举报该会话', 403);
  const [peer, product] = await Promise.all([
    find('users', 'openid', peerOpenid), find('products', 'productId', session.productId),
  ]);
  if (!peer || !product) missing();
  return { user, session, peer, product };
}
async function freshContext(transaction, ctx, openid) {
  const user = await doc(transaction, 'users', ctx.user._id);
  assertUser(user);
  if (user.openid !== openid) reject('无权举报该会话', 403);
  const session = await doc(transaction, 'chat_sessions', ctx.session._id);
  assertSession(session, openid);
  const peer = await doc(transaction, 'users', ctx.peer._id);
  const product = await doc(transaction, 'products', ctx.product._id);
  if (!peer || !product) missing();
  const expectedPeer = session.buyerOpenid === openid ? session.sellerOpenid : session.buyerOpenid;
  if (peer.openid !== expectedPeer || sessionKey(session) !== sessionKey(ctx.session)
    || session.productId !== ctx.session.productId || ![product.productId, product._id].includes(session.productId)) reject('无权举报该会话', 403);
  return { user, session, peer, product };
}
const sessionKey = session => session.sessionId || session._id;
const reportId = (openid, submissionId) => hash(JSON.stringify([openid, identifier(submissionId)]));
const guardId = (openid, sessionId) => hash(JSON.stringify([openid, sessionId]));
const receipt = report => ({ submitted: true, reportId: report._id, submissionId: report.submissionId });
const userSnapshot = user => ({ openid: user.openid, nickname: user.nickname || '校园用户', account: user.account || '' });

module.exports = { cloud, db, crypto, BusinessError, reject, hash, identifier, doc, find, assertUser,
  userContext, context, freshContext, sessionKey, reportId, guardId, receipt, userSnapshot };

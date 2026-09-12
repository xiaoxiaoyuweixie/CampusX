const { db, command, reject, hash, find, doc, assertUser, assertSession, snapshot,
  sessionKey, peerId, normalizeSession, context, pagination, productReason } = require('../lib/core');

async function openSession(data, openid) {
  const user = await find('users', 'openid', openid);
  assertUser(user);
  const product = await find('products', 'productId', data.productId);
  if (!product) reject('商品不存在', 40400);
  if (product.openid === openid) reject('不能与自己发起聊天');
  const peer = await find('users', 'openid', product.openid);
  if (!peer || peer.status === 'disabled') reject('当前无法与该用户联系');
  const productId = product.productId || product._id;
  const existing = await db.collection('chat_sessions').where({ productId, buyerOpenid: openid, sellerOpenid: peer.openid }).limit(1).get();
  if (existing.data[0]) {
    const ctx = await context(sessionKey(existing.data[0]), openid);
    if (!ctx.peer || ctx.peer.status === 'disabled') reject('当前无法与该用户联系');
    if ((!ctx.product || ctx.product.status !== 'on_sale') && !ctx.hasHistory) reject(productReason(ctx.product));
    return { session: normalizeSession(ctx.session, openid, ctx.peer), sessionId: sessionKey(ctx.session) };
  }
  const sessionId = `S${hash(JSON.stringify([openid, peer.openid, productId])).slice(0, 48)}`;
  const session = await db.runTransaction(async transaction => {
    assertUser(await doc(transaction, 'users', user._id));
    const other = await doc(transaction, 'users', peer._id);
    if (!other || other.status === 'disabled') reject('当前无法与该用户联系');
    const latest = await doc(transaction, 'products', product._id);
    if (!latest || latest.status !== 'on_sale') reject(productReason(latest));
    const duplicate = await doc(transaction, 'chat_sessions', sessionId);
    if (duplicate) return duplicate;
    const createdAt = new Date();
    const payload = {
      sessionId, productId, productTitle: latest.title || '', productCover: latest.cover || (latest.images || [])[0] || '',
      buyerOpenid: openid, sellerOpenid: peer.openid, participants: [openid, peer.openid],
      buyerSnapshot: snapshot(user), sellerSnapshot: snapshot(other),
      lastMessage: {}, unreadCount: { buyer: 0, seller: 0 }, messageCount: 0,
      status: 'active', createdAt, updatedAt: createdAt,
    };
    await transaction.collection('chat_sessions').doc(sessionId).set({ data: payload });
    return { ...payload, _id: sessionId };
  });
  return { session: normalizeSession(session, openid, peer), sessionId: sessionKey(session) };
}

async function getSessionList(data, openid) {
  assertUser(await find('users', 'openid', openid));
  const { page, pageSize, skip } = pagination(data);
  const query = { participants: command.all([openid]), status: 'active' };
  const total = (await db.collection('chat_sessions').where(query).count()).total;
  const res = await db.collection('chat_sessions').where(query).orderBy('updatedAt', 'desc').skip(skip).limit(pageSize).get();
  const list = [];
  for (const session of res.data) {
    const peer = await find('users', 'openid', peerId(session, openid));
    list.push(normalizeSession(session, openid, peer));
  }
  return { list, page, pageSize, total };
}
async function markRead(data, openid) {
  assertUser(await find('users', 'openid', openid));
  const session = await find('chat_sessions', 'sessionId', data.sessionId);
  assertSession(session, openid);
  const role = session.buyerOpenid === openid ? 'buyer' : 'seller';
  await db.collection('chat_sessions').doc(session._id).update({ data: { [`unreadCount.${role}`]: 0 } });
  return true;
}
module.exports = { openSession, getSessionList, markRead };

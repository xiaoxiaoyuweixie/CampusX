const { cloud, db, command, crypto, context, freshContext, permissions, reject, sessionKey, peerId,
  doc, normalizeMessage, normalizeSession, pagination } = require('../lib/core');
const { messageId } = require('../lib/message-id');
const { storeImage } = require('./images');

function validateText(content) {
  if (typeof content !== 'string' || !content.trim()) reject('请输入消息内容', 40001);
  if (Array.from(content).length > 1000) reject('单条消息最多输入1000字', 40001);
}
async function sendMessage(data, openid) {
  // Older released clients had no submission ID and only supported text.
  if (data.clientMessageId === undefined && (!data.type || data.type === 'text')) {
    data = { ...data, clientMessageId: `legacy_${crypto.randomBytes(16).toString('hex')}` };
  }
  const ctx = await context(data.sessionId, openid);
  const key = sessionKey(ctx.session);
  const id = messageId(key, openid, data.clientMessageId);
  const type = data.type || 'text';
  if (!['text', 'image'].includes(type)) reject('暂不支持该消息类型', 40001);
  const content = data.content === undefined ? data.text : data.content;
  if (type === 'text') validateText(content);
  const existing = await doc(db, 'chat_messages', id);
  if (existing) {
    if (existing.type !== type || (type === 'text' && existing.content !== content)) reject('消息内容已变化，请重新发送', 40900);
    return { message: normalizeMessage(existing, openid), messageId: id };
  }
  const state = permissions(ctx);
  if (!state.canSend) reject(state.sendReason);
  const image = type === 'image' ? await storeImage(data, ctx, openid) : null;
  const message = await db.runTransaction(async transaction => {
    const latest = await freshContext(transaction, ctx, openid);
    const duplicate = await doc(transaction, 'chat_messages', id);
    if (duplicate) {
      if (duplicate.type !== type || (type === 'text' && duplicate.content !== content)) reject('消息内容已变化，请重新发送', 40900);
      return duplicate;
    }
    const currentState = permissions(latest);
    if (!currentState.canSend) reject(currentState.sendReason);
    const role = latest.session.buyerOpenid === openid ? 'buyer' : 'seller';
    const peerRole = role === 'buyer' ? 'seller' : 'buyer';
    const createdAt = new Date();
    const requestedTime = Number(data.createdTimestamp);
    const createdTimestamp = Number.isFinite(requestedTime) && requestedTime > 0 ? Math.min(requestedTime, createdAt.getTime()) : createdAt.getTime();
    const payload = {
      messageId: id, clientMessageId: data.clientMessageId, sessionId: key, productId: latest.session.productId,
      senderOpenid: openid, receiverOpenid: peerId(latest.session, openid), senderRole: role,
      type, content: type === 'text' ? content : '[图片]', image, status: 'sent', createdAt, createdTimestamp,
    };
    await transaction.collection('chat_messages').doc(id).set({ data: payload });
    const update = { updatedAt: createdAt, messageCount: Number(latest.session.messageCount || 0) + 1,
      [`unreadCount.${peerRole}`]: command.inc(1) };
    if (!latest.session.lastMessage || createdTimestamp >= Number(latest.session.lastMessage.createdTimestamp || 0)) {
      update.lastMessage = command.set({ messageId: id, type, content: payload.content, senderOpenid: openid, createdAt, createdTimestamp });
    }
    await transaction.collection('chat_sessions').doc(latest.session._id).update({ data: update });
    return payload;
  });
  return { message: normalizeMessage(message, openid), messageId: id };
}

async function getMessages(data, openid) {
  const ctx = await context(data.sessionId, openid);
  const { page, pageSize, skip } = pagination(data);
  const query = { sessionId: sessionKey(ctx.session), status: 'sent' };
  const result = await db.collection('chat_messages').where(query).orderBy('createdTimestamp', 'desc').skip(skip).limit(pageSize).get();
  const total = (await db.collection('chat_messages').where(query).count()).total;
  const urls = new Map();
  const files = result.data.filter(item => item.type === 'image').map(item => item.image.fileID);
  for (let offset = 0; offset < files.length; offset += 50) {
    try {
      const response = await cloud.getTempFileURL({ fileList: files.slice(offset, offset + 50).map(fileID => ({ fileID, maxAge: 600 })) });
      (response.fileList || []).forEach(file => { if (!file.status) urls.set(file.fileID, file.tempFileURL); });
    } catch (err) { /* Keep history readable when image URL generation fails. */ }
  }
  const list = result.data.reverse().map(raw => {
    const item = normalizeMessage(raw, openid);
    if (item.image) item.image.url = urls.get(raw.image.fileID) || '';
    return item;
  });
  const role = ctx.session.buyerOpenid === openid ? 'buyer' : 'seller';
  await db.runTransaction(async transaction => {
    const session = await doc(transaction, 'chat_sessions', ctx.session._id);
    const last = (session || {}).lastMessage || {};
    if (session && result.data.some(item => item.messageId === last.messageId
      || (!last.messageId && item.createdTimestamp === last.createdTimestamp))) {
      await transaction.collection('chat_sessions').doc(session._id).update({ data: { [`unreadCount.${role}`]: 0 } });
    }
  });
  return { list, session: normalizeSession(ctx.session, openid, ctx.peer), permissions: permissions(ctx), page, pageSize, total };
}
module.exports = { sendMessage, getMessages, validateText };

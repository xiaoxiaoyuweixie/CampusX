const { cloud, db, crypto, hash, reject, doc, context, permissions, sessionKey, normalizeMessage } = require('../lib/core');
const { clientId, messageId } = require('../lib/message-id');
const { MAX_IMAGE_BYTES, imageFormat } = require('../lib/image-format');

function stagingPrefix(sessionId, openid, id) {
  return `chat-staging/${hash(JSON.stringify([openid, sessionId, clientId(id)]))}/`;
}
async function prepareImage(data, openid) {
  const ctx = await context(data.sessionId, openid);
  const key = sessionKey(ctx.session);
  const id = messageId(key, openid, data.clientMessageId);
  const existing = await doc(db, 'chat_messages', id);
  if (existing) {
    if (existing.type !== 'image') reject('消息内容已变化，请重新发送', 40900);
    return { message: normalizeMessage(existing, openid) };
  }
  const state = permissions(ctx);
  if (!state.canSend) reject(state.sendReason);
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(data.extension)) reject('暂不支持该图片格式', 40001);
  if (!(data.size > 0) || data.size > MAX_IMAGE_BYTES) reject('单张图片不能超过10MB', 40001);
  return { cloudPath: `${stagingPrefix(key, openid, data.clientMessageId)}${crypto.randomBytes(16).toString('hex')}.${data.extension}` };
}
async function storeImage(data, ctx, openid) {
  const image = data.image || {};
  const fileID = image.fileID;
  const prefix = stagingPrefix(sessionKey(ctx.session), openid, data.clientMessageId);
  const matched = typeof fileID === 'string' && /^cloud:\/\/([^/]+)\/(.+)$/.exec(fileID);
  const env = cloud.getWXContext().ENV;
  if (!matched || (env && !matched[1].startsWith(`${env}.`)) || !matched[2].startsWith(prefix)
    || !/^[a-f0-9]{32}\.(jpg|jpeg|png|webp)$/.test(matched[2].slice(prefix.length))) reject('图片信息无效，请重新选择', 40001);
  const result = await cloud.downloadFile({ fileID });
  const bytes = result.fileContent;
  if (!bytes || bytes.length > MAX_IMAGE_BYTES) reject('单张图片不能超过10MB', 40001);
  const format = imageFormat(bytes);
  if (!format) reject('暂不支持该图片格式', 40001);
  // A server-owned copy prevents the sender from replacing a sent image later.
  const saved = await cloud.uploadFile({ cloudPath: `chat-media/${crypto.randomBytes(24).toString('hex')}.${format}`, fileContent: bytes });
  return { fileID: saved.fileID, size: bytes.length, format,
    width: Math.max(1, Math.min(20000, Number(image.width) || 1)), height: Math.max(1, Math.min(20000, Number(image.height) || 1)) };
}
async function imageUrl(fileID) {
  const result = await cloud.getTempFileURL({ fileList: [{ fileID, maxAge: 600 }] });
  const file = (result.fileList || [])[0];
  if (!file || !file.tempFileURL || (file.status && file.status !== 0)) reject('图片加载失败，请重试', 50000);
  return file.tempFileURL;
}
async function getImage(data, openid) {
  const ctx = await context(data.sessionId, openid);
  const message = await doc(db, 'chat_messages', data.messageId);
  if (!message || message.sessionId !== sessionKey(ctx.session) || message.type !== 'image') reject('图片不存在', 40400);
  return { url: await imageUrl(message.image.fileID) };
}
module.exports = { prepareImage, storeImage, imageUrl, getImage };

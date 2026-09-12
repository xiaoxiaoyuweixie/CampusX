const { hash, reject } = require('./core');
function clientId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{8,96}$/.test(value)) reject('消息标识无效，请重新发送', 40001);
  return value;
}
function messageId(sessionId, openid, id) {
  return `M${hash(JSON.stringify([sessionId, openid, clientId(id)])).slice(0, 48)}`;
}
module.exports = { clientId, messageId };

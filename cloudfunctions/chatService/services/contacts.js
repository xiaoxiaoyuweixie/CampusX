const { db, context, freshContext, permissions, contactItem, mask, reject } = require('../lib/core');

async function getChatState(data, openid) {
  return permissions(await context(data.sessionId, openid));
}
async function getContact(data, openid) {
  if (!['wechat', 'phone'].includes(data.type)) reject('请选择联系方式', 40001);
  if (!['preview', 'copy', 'call'].includes(data.purpose)
    || (data.type === 'phone' && data.purpose !== 'call')
    || (data.type === 'wechat' && data.purpose === 'call')) reject('操作不支持', 40001);
  const ctx = await context(data.sessionId, openid);
  return db.runTransaction(async transaction => {
    const latest = await freshContext(transaction, ctx, openid);
    const state = permissions(latest);
    if (!state[data.type].available) reject(state[data.type].reason);
    const { value } = contactItem(latest.peer, data.type);
    if (data.purpose === 'preview') return { masked: mask(value) };
    return { value, masked: data.type === 'wechat' ? mask(value) : '' };
  });
}
module.exports = { getChatState, getContact };

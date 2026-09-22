const { cloud, BusinessError } = require('./lib/core');
const sessions = require('./services/sessions');
const messages = require('./services/messages');
const contacts = require('./services/contacts');
const images = require('./services/images');

const actions = {
  openSession: sessions.openSession, createSession: sessions.openSession,
  getSessionList: sessions.getSessionList, getUnreadState: sessions.getUnreadState, markRead: sessions.markRead,
  getMessages: messages.getMessages, sendMessage: messages.sendMessage,
  getChatState: contacts.getChatState, getContact: contacts.getContact,
  prepareImage: images.prepareImage, getImage: images.getImage,
};

exports.main = async (event = {}) => {
  try {
    const openid = cloud.getWXContext().OPENID;
    if (!openid) throw new BusinessError('请先登录', 40004);
    const handler = Object.prototype.hasOwnProperty.call(actions, event.action) && actions[event.action];
    if (!handler) throw new BusinessError('暂不支持此操作', 40001);
    const data = await handler(event.data || {}, openid);
    return { code: 0, message: 'success', data };
  } catch (err) {
    return { code: err instanceof BusinessError ? err.code : 50000,
      message: err instanceof BusinessError ? err.message : '操作失败，请重试', data: null };
  }
};

const { api } = require('../../api/index.js');

Page({
  data: {
    name: '',
    userId: '',
    sessionId: '',
    messages: [],
    input: '',
    scrollToView: '',
  },
  async onLoad(options) {
    const name = decodeURIComponent(options.name || '对方');
    const userId = options.userId || '';
    const productId = options.productId || '';
    wx.setNavigationBarTitle({ title: name });
    const sessionRes = await api.createSession({ userA: userId, userB: (wx.getStorageSync('userInfo') || {}).openid || '', productId });
    const sessionPayload = sessionRes.result || {};
    const sessionId = sessionPayload.code === 0 && sessionPayload.data ? (sessionPayload.data._id || sessionPayload.data.id) : '';
    if (sessionId) {
      const msgRes = await api.getMessages(sessionId);
      const msgPayload = msgRes.result || {};
      this.setData({ name, userId, sessionId, messages: msgPayload.code === 0 ? (msgPayload.data || []) : [], scrollToView: '' });
    } else {
      this.setData({ name, userId, sessionId, messages: [] });
    }
  },
  onInput(e) { this.setData({ input: e.detail.value }); },
  async onSend() {
    const text = this.data.input.trim();
    if (!text || !this.data.sessionId) return;
    const res = await api.sendMessage({ sessionId: this.data.sessionId, toUser: this.data.userId, text });
    const payload = res.result || {};
    if (payload.code === 0) {
      const id = payload.data._id || `m${Date.now()}`;
      const messages = [...this.data.messages, { id, fromUser: 'me', text, createdAt: '刚刚' }];
      this.setData({ messages, input: '', scrollToView: id });
    }
  },
});

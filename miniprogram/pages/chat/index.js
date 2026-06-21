const { api } = require('../../api/index.js');

Page({
  data: {
    sessionId: '',
    session: null,
    name: '聊天',
    messages: [],
    input: '',
    scrollToView: '',
    loading: false,
    sending: false,
  },

  timer: null,

  async onLoad(options) {
    const sessionId = options.sessionId || '';
    if (!sessionId) {
      wx.showToast({ title: '缺少会话信息', icon: 'none' });
      return;
    }
    this.setData({ sessionId });
    await this.loadMessages(true);
    this.startPolling();
  },

  onUnload() {
    this.stopPolling();
  },

  onInput(e) {
    this.setData({ input: e.detail.value });
  },

  startPolling() {
    this.stopPolling();
    this.timer = setInterval(() => {
      this.loadMessages(false);
    }, 5000);
  },

  stopPolling() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  async loadMessages(showLoading) {
    const { sessionId } = this.data;
    if (!sessionId) return;
    if (showLoading) this.setData({ loading: true });
    try {
      const res = await api.getMessages({ sessionId, page: 1, pageSize: 50 });
      const payload = res.result || {};
      if (payload.code !== 0) {
        console.error('[chat] getMessages failed:', payload);
        if (showLoading) wx.showToast({ title: payload.message || '消息加载失败', icon: 'none' });
        return;
      }
      const list = (payload.data && payload.data.list) || [];
      const session = (payload.data && payload.data.session) || null;
      const latest = list[list.length - 1];
      this.setData({
        session,
        name: session ? session.name : this.data.name,
        messages: list,
        scrollToView: latest ? latest.id : '',
      });
      if (session && session.name) {
        wx.setNavigationBarTitle({ title: session.name });
      }
    } catch (err) {
      console.error('[chat] getMessages error:', err);
      if (showLoading) wx.showToast({ title: err.errMsg || err.message || '消息加载失败', icon: 'none' });
    } finally {
      if (showLoading) this.setData({ loading: false });
    }
  },

  async onSend() {
    const text = this.data.input.trim();
    if (!text || !this.data.sessionId || this.data.sending) return;
    this.setData({ sending: true });
    try {
      const res = await api.sendMessage({ sessionId: this.data.sessionId, content: text });
      const payload = res.result || {};
      if (payload.code !== 0) {
        console.error('[chat] sendMessage failed:', payload);
        wx.showToast({ title: payload.message || '发送失败', icon: 'none' });
        return;
      }
      const message = payload.data && payload.data.message;
      const messages = message ? [...this.data.messages, message] : this.data.messages;
      this.setData({
        messages,
        input: '',
        scrollToView: message ? message.id : this.data.scrollToView,
      });
      this.loadMessages(false);
    } catch (err) {
      console.error('[chat] sendMessage error:', err);
      wx.showToast({ title: err.errMsg || err.message || '发送失败', icon: 'none' });
    } finally {
      this.setData({ sending: false });
    }
  },
});

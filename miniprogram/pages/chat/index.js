const { chatHistory } = require('../../mock/messages.js');

Page({
  data: {
    name: '',
    userId: '',
    messages: [],
    input: '',
    scrollToView: '',
  },
  onLoad(options) {
    const name = decodeURIComponent(options.name || '对方');
    const userId = options.userId || '';
    wx.setNavigationBarTitle({ title: name });
    const messages = (chatHistory[userId] || []).map((m, i) => ({ ...m, id: 'm' + i }));
    this.setData({ name, userId, messages, scrollToView: messages.length ? 'm' + (messages.length - 1) : '' });
  },
  onInput(e) { this.setData({ input: e.detail.value }); },
  onSend() {
    const text = this.data.input.trim();
    if (!text) return;
    const id = 'm' + this.data.messages.length;
    const messages = [...this.data.messages, { id, from: 'me', text, time: '刚刚' }];
    this.setData({ messages, input: '', scrollToView: id });
  },
});

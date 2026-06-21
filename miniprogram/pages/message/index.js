const router = require('../../utils/router.js');
const { api } = require('../../api/index.js');

Page({
  data: {
    systemNotices: [],
    chats: [],
    loading: false,
  },

  async onShow() {
    await this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });
    const [noticePayload, chatPayload] = await Promise.all([
      this.loadSystemNotices(),
      this.loadChatSessions(),
    ]);

    this.setData({
      systemNotices: noticePayload,
      chats: chatPayload,
      loading: false,
    });
  },

  async loadSystemNotices() {
    try {
      const res = await api.systemNoticeList();
      const payload = res.result || {};
      return payload.code === 0 ? (payload.data || []) : [];
    } catch (err) {
      return [];
    }
  },

  async loadChatSessions() {
    try {
      const res = await api.getSessionList({ page: 1, pageSize: 50 });
      const payload = res.result || {};
      if (payload.code !== 0) {
        wx.showToast({ title: payload.message || '会话加载失败', icon: 'none' });
        return [];
      }
      return (payload.data && payload.data.list) || [];
    } catch (err) {
      wx.showToast({ title: '会话加载失败', icon: 'none' });
      return [];
    }
  },

  onChatTap(e) {
    const { id } = e.currentTarget.dataset;
    if (id) router.toChatSession(id);
  },

  onNoticeTap() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },
});

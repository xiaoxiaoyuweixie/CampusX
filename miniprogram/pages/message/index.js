const router = require('../../utils/router.js');
const { api } = require('../../api/index.js');
const unread = require('../../utils/unread.js');

Page({
  data: {
    systemNotices: [],
    chats: [],
    loading: false,
  },

  async onShow() {
    this.visible = true;
    const owner = unread.currentOwner();
    if (this.listOwner !== owner) {
      this.listOwner = owner;
      this.loadVersion = (this.loadVersion || 0) + 1;
      this.setData({ chats: [], systemNotices: [], loading: false });
    }
    if (this.unsubscribeUnread) this.unsubscribeUnread();
    this.unsubscribeUnread = unread.subscribe(event => {
      if (!this.visible) return;
      if (event.type === 'reset') {
        this.listOwner = event.owner;
        this.loadVersion = (this.loadVersion || 0) + 1;
        this.setData({ chats: [], systemNotices: [], loading: false });
      } else this.loadData(false);
    });
    unread.refresh();
    await this.loadData();
  },

  onHide() {
    this.visible = false;
    this.loadVersion = (this.loadVersion || 0) + 1;
    if (this.unsubscribeUnread) this.unsubscribeUnread();
    this.unsubscribeUnread = null;
  },

  onUnload() { this.onHide(); },

  async loadData(showLoading = true) {
    const owner = unread.currentOwner();
    if (!this.visible || !owner) {
      if (this.visible) this.setData({ chats: [], systemNotices: [], loading: false });
      return;
    }
    if (this.loadingRequest) { this.reloadQueued = true; return; }
    const version = this.loadVersion || 0;
    this.loadingRequest = true;
    if (showLoading) this.setData({ loading: true });
    try {
      const [noticePayload, chatPayload] = await Promise.all([
        showLoading ? this.loadSystemNotices() : Promise.resolve(null),
        this.loadChatSessions(),
      ]);
      if (!this.visible || owner !== unread.currentOwner() || version !== (this.loadVersion || 0)) return;
      const update = { loading: false };
      if (noticePayload !== null) update.systemNotices = noticePayload;
      if (chatPayload !== null) update.chats = chatPayload;
      else if (showLoading) wx.showToast({ title: '会话加载失败', icon: 'none' });
      this.setData(update);
    } finally {
      this.loadingRequest = false;
      if (this.reloadQueued) {
        this.reloadQueued = false;
        if (this.visible) this.loadData(false);
      }
    }
  },

  async loadSystemNotices() {
    try {
      const res = await api.systemNoticeList();
      const payload = res.result || {};
      return payload.code === 0 ? (payload.data || []) : null;
    } catch (err) {
      return null;
    }
  },

  async loadChatSessions() {
    try {
      const res = await api.getSessionList({ page: 1, pageSize: 50 });
      const payload = res.result || {};
      if (payload.code !== 0) {
        return null;
      }
      return (payload.data && payload.data.list) || [];
    } catch (err) {
      return null;
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

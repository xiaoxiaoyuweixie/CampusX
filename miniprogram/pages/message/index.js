const router = require('../../utils/router.js');
const { api } = require('../../api/index.js');

Page({
  data: { systemNotices: [], chats: [] },
  async onShow() {
    const [noticeRes, chatRes] = await Promise.all([api.systemNoticeList(), api.getSessionList()]);
    const noticePayload = noticeRes.result || {};
    const chatPayload = chatRes.result || {};
    if (noticePayload.code === 0) this.setData({ systemNotices: noticePayload.data || [] });
    if (chatPayload.code === 0) this.setData({ chats: chatPayload.data || [] });
  },
  onChatTap(e) {
    const { id, name, userid, userId, productid } = e.currentTarget.dataset;
    router.toChat(userid || userId || id, name, productid);
  },
  onNoticeTap() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },
});

const { systemNotices, chats } = require('../../mock/messages.js');
const router = require('../../utils/router.js');

Page({
  data: { systemNotices, chats },
  onChatTap(e) {
    const { id, name } = e.currentTarget.dataset;
    router.toChat(id, name);
  },
  onNoticeTap() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },
});

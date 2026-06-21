const storage = require('../../utils/storage.js');
const { api } = require('../../api/index.js');

Page({
  data: {
    user: {},
    publishedCount: 0,
    favoriteCount: 0,
  },
  async onShow() {
    const user = storage.get('userInfo', {});
    this.setData({ user });
    const res = await api.getDashboard();
    const payload = res.result || {};
    if (payload.code === 0) {
      const latestUser = payload.data.user ? { ...user, ...payload.data.user, logged: true } : user;
      storage.set('userInfo', latestUser);
      this.setData({
        user: latestUser,
        publishedCount: payload.data.publishedCount || 0,
        favoriteCount: payload.data.favoriteCount || 0,
      });
    }
  },
  onLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },
  onMenuTap(e) {
    const action = e.currentTarget.dataset.action;
    if (action === 'published') {
      wx.navigateTo({ url: '/pages/my-publish/index' });
      return;
    }

    if (action === 'settings') {
      wx.navigateTo({ url: '/pages/settings/index' });
      return;
    }

    if (action === 'favorites') {
      wx.navigateTo({ url: '/pages/favorites/index' });
      return;
    }

    wx.showToast({ title: '功能开发中', icon: 'none' });
  },
});

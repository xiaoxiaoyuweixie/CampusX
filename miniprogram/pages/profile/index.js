const storage = require('../../utils/storage.js');

Page({
  data: {
    user: {},
    publishedCount: 0,
    favoriteCount: 0,
  },
  onShow() {
    const user = storage.get('userInfo', {});
    this.setData({
      user,
      publishedCount: storage.get('myPublished', []).length,
      favoriteCount: storage.getFavorites().length,
    });
  },
  onLogin() {
    const user = { ...this.data.user, logged: true, nickname: '校园用户', verified: true };
    storage.set('userInfo', user);
    this.setData({ user });
    wx.showToast({ title: '登录成功', icon: 'success' });
  },
  onMenuTap(e) {
    const action = e.currentTarget.dataset.action;

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

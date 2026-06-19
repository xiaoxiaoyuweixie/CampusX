// 全局 App
App({
  onLaunch() {
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.setStorageSync('userInfo', {
        nickname: '校园游客',
        avatar: '',
        school: '西南大学',
        verified: false,
        logged: false,
      });
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    if (!userInfo.logged) {
      wx.reLaunch({ url: '/pages/login/login' });
    }
    if (!wx.getStorageSync('favorites')) {
      wx.setStorageSync('favorites', []);
    }
    if (!wx.getStorageSync('myPublished')) {
      wx.setStorageSync('myPublished', []);
    }
  },
  globalData: {
    school: '西南大学',
  },
});

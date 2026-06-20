// 全局 App
App({
  onLaunch() {
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloud1-d6g5stkeb92288dee',
        traceUser: true,
      });
    }

    const userInfo = wx.getStorageSync('userInfo') || null;
    if (!userInfo) {
      wx.setStorageSync('userInfo', {
        nickname: '校园游客',
        avatar: '',
        school: '西南大学',
        verified: false,
        logged: false,
      });
    }
    if (!wx.getStorageSync('token')) {
      wx.setStorageSync('token', '');
    }
  },
  globalData: {
    school: '西南大学',
    envId: 'cloud1-d6g5stkeb92288dee',
  },
});
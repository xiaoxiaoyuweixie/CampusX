const storage = require('../../utils/storage.js');

Page({
  data: {
    account: 'admin',
    password: '123456',
    agreed: true,
  },
  onLoad(options) {
    this.redirect = (options && options.redirect) ? decodeURIComponent(options.redirect) : '/pages/home/index';
  },
  onAccountInput(e) {
    this.setData({ account: e.detail.value });
  },
  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },
  handleLogin() {
    const { account, password, agreed } = this.data;
    if (!account || !password) {
      wx.showToast({ title: '请输入账号和密码', icon: 'none' });
      return;
    }
    if (!agreed) {
      wx.showToast({ title: '请先勾选用户协议', icon: 'none' });
      return;
    }

    const userInfo = {
      nickname: account,
      avatar: '',
      school: '西南大学',
      verified: true,
      logged: true,
    };

    storage.set('userInfo', userInfo);
    wx.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => {
      wx.reLaunch({ url: this.redirect || '/pages/home/index' });
    }, 300);
  },
});

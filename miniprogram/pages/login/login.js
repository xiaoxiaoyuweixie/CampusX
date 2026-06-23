const storage = require('../../utils/storage.js');
const { api } = require('../../api/index.js');

Page({
  data: {
    account: '',
    password: '',
    agreed: false,
    showPassword: false,
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

  onToggleAgreed() {
    this.setData({ agreed: !this.data.agreed });
  },

  onTogglePasswordVisible() {
    this.setData({ showPassword: !this.data.showPassword });
  },

  async handleLogin() {
    const { account, password, agreed } = this.data;
    if (!account || !password) {
      wx.showToast({ title: '请输入账号和密码', icon: 'none' });
      return;
    }
    if (!agreed) {
      wx.showToast({ title: '请先勾选用户协议', icon: 'none' });
      return;
    }

    const res = await api.login({ account, password, nickname: account, school: '西南大学' });
    const payload = res.result || {};
    if (payload.code !== 0) {
      wx.showToast({ title: payload.message || '登录失败', icon: 'none' });
      return;
    }

    const userInfo = {
      ...payload.data.user,
      token: payload.data.token,
      logged: true,
    };
    storage.set('token', payload.data.token);
    storage.set('userInfo', userInfo);
    wx.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => {
      wx.reLaunch({ url: this.redirect || '/pages/home/index' });
    }, 300);
  },
});

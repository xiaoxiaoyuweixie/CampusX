const storage = require('../../utils/storage.js');
const { api } = require('../../api/index.js');

Page({
  data: {
    account: '222023603052106',
    password: 'swu123456',
    agreed: false,
  },
  onLoad(options) {
    this.redirect = (options && options.redirect) ? decodeURIComponent(options.redirect) : '/pages/home/index';
  },
  onAccountInput(e) {
    this.setData({ account: (e.detail.value || '').trim() });
  },
  onPasswordInput(e) {
    this.setData({ password: (e.detail.value || '').trim() });
  },
  onToggleAgreed() {
    this.setData({ agreed: !this.data.agreed });
  },
  async handleLogin() {
    const { account, password, agreed } = this.data;
    console.log('account:', account);
    console.log('password:', password);

    if (!agreed) {
      wx.showToast({ title: '请先勾选用户协议', icon: 'none' });
      return;
    }

    if (!account || !password) {
      wx.showToast({ title: '请输入账号和密码', icon: 'none' });
      return;
    }

    let res;
    try {
      res = await api.login({ account, password });
    } catch (error) {
      wx.showToast({ title: error.message || '登录失败', icon: 'none' });
      return;
    }

    const payload = res.result || {};
    if (payload.code !== 0) {
      wx.showToast({ title: payload.message || '账号或密码错误', icon: 'none' });
      return;
    }

    const { openid, nickname, avatar, isDefaultNickname } = payload.data || {};

    const userInfo = {
      openid,
      nickname: nickname || '',
      avatar: avatar || '',
      isDefaultNickname: !!isDefaultNickname,
      logged: true,
    };
    storage.set('userInfo', userInfo);
    wx.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => {
      if (!userInfo.nickname) {
        wx.reLaunch({ url: '/pages/profile/index' });
        return;
      }
      wx.reLaunch({ url: this.redirect || '/pages/home/index' });
    }, 300);
  },
});

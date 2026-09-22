const storage = require('../../utils/storage.js');
const { api } = require('../../api/index.js');
const unread = require('../../utils/unread.js');

const LOGIN_RETRY_DELAYS = [0, 500];

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function requestLoginWithRetry(data) {
  let lastError = null;

  for (const delay of LOGIN_RETRY_DELAYS) {
    if (delay) await wait(delay);
    try {
      return await api.login(data);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('login_request_failed');
}

function getLoginErrorMessage(error) {
  const message = String(error && error.errMsg || error && error.message || '').toLowerCase();
  if (message.includes('timeout')) return '登录请求超时，请检查网络后重试';
  if (message.includes('network') || message.includes('fail')) return '网络连接异常，请稍后重试';
  return '登录服务暂时不可用，请稍后重试';
}

Page({
  data: {
    account: '',
    password: '',
    agreed: false,
    showPassword: false,
    loginLoading: false,
  },

  loginSubmitting: false,
  redirectTimer: null,

  onLoad(options) {
    this.redirect = (options && options.redirect) ? decodeURIComponent(options.redirect) : '/pages/home/index';
  },

  onUnload() {
    if (this.redirectTimer) clearTimeout(this.redirectTimer);
    this.redirectTimer = null;
    this.loginSubmitting = false;
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

  async handleLogin(e) {
    if (this.loginSubmitting) return;

    const formValues = e && e.detail && e.detail.value || {};
    const account = String(formValues.account != null ? formValues.account : this.data.account).trim();
    const password = String(formValues.password != null ? formValues.password : this.data.password);
    const { agreed } = this.data;
    if (!account || !password) {
      wx.showToast({ title: '请输入账号和密码', icon: 'none' });
      return;
    }
    if (!agreed) {
      wx.showToast({ title: '请先勾选用户协议', icon: 'none' });
      return;
    }

    this.loginSubmitting = true;
    this.setData({ account, password, loginLoading: true });

    try {
      const res = await requestLoginWithRetry({
        account,
        password,
        nickname: account,
        school: '西南大学',
      });
      const payload = res.result || {};
      if (payload.code !== 0) {
        wx.showToast({ title: payload.message || '登录失败', icon: 'none' });
        this.resetLoginState();
        return;
      }

      const userInfo = {
        ...payload.data.user,
        token: payload.data.token,
        logged: true,
      };
      storage.set('token', payload.data.token);
      storage.set('userInfo', userInfo);
      unread.accountChanged();
      wx.showToast({ title: '登录成功', icon: 'success' });
      this.redirectTimer = setTimeout(() => {
        this.redirectTimer = null;
        wx.reLaunch({
          url: this.redirect || '/pages/home/index',
          fail: () => {
            this.resetLoginState();
            wx.showToast({ title: '页面跳转失败，请重试', icon: 'none' });
          },
        });
      }, 300);
    } catch (error) {
      this.resetLoginState();
      wx.showToast({ title: getLoginErrorMessage(error), icon: 'none' });
    }
  },

  resetLoginState() {
    this.loginSubmitting = false;
    this.setData({ loginLoading: false });
  },
});

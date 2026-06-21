const storage = require('../../utils/storage.js');
const { api } = require('../../api/index.js');

const DEFAULT_AVATAR = 'cloud://cloud1-d6g5stkeb92288dee.636c-cloud1-d6g5stkeb92288dee-1445397435/system/default-avatar.png';
const createDefaultNickname = () => `用户${Math.floor(100000 + Math.random() * 900000)}`;
const normalizeUser = (user = {}) => ({
  ...user,
  nickname: user.nickname || createDefaultNickname(),
  avatar: user.avatar || DEFAULT_AVATAR,
  isDefaultNickname: typeof user.isDefaultNickname === 'boolean' ? user.isDefaultNickname : !user.nickname,
});

Page({
  data: {
    user: {},
    publishedCount: 0,
    favoriteCount: 0,
  },
  async onShow() {
    const localUser = normalizeUser(storage.get('userInfo', {}));
    this.setData({ user: localUser });

    try {
      const res = await api.getUserInfo();
      const payload = res.result || {};
      if (payload.code === 0 && payload.data) {
        const user = normalizeUser(payload.data);
        storage.set('userInfo', { ...localUser, ...user });
        this.setData({ user: { ...localUser, ...user } });
      } else {
        storage.set('userInfo', localUser);
        this.setData({ user: localUser });
      }
    } catch (error) {
      storage.set('userInfo', localUser);
      this.setData({ user: localUser });
    }

    const res = await api.getDashboard();
    const payload = res.result || {};
    if (payload.code === 0) {
      const dashboardUser = normalizeUser(payload.data.user || {});
      const mergedUser = normalizeUser({ ...this.data.user, ...dashboardUser });
      storage.set('userInfo', mergedUser);
      this.setData({
        user: mergedUser,
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

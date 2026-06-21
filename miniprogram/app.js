// 全局 App
const DEFAULT_AVATAR = 'cloud://cloud1-d6g5stkeb92288dee.636c-cloud1-d6g5stkeb92288dee-1445397435/system/default-avatar.png';
const createDefaultNickname = () => `用户${Math.floor(100000 + Math.random() * 900000)}`;

const normalizeUser = (user = {}) => ({
  ...user,
  nickname: user.nickname || createDefaultNickname(),
  avatar: user.avatar || DEFAULT_AVATAR,
  isDefaultNickname: typeof user.isDefaultNickname === 'boolean' ? user.isDefaultNickname : !user.nickname,
});

App({
  onLaunch() {
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloud1-d6g5stkeb92288dee',
        traceUser: true,
      });
    }

    const userInfo = normalizeUser(wx.getStorageSync('userInfo') || {});
    wx.setStorageSync('userInfo', userInfo);

    if (!wx.getStorageSync('token')) {
      wx.setStorageSync('token', '');
    }
  },
  globalData: {
    school: '西南大学',
    envId: 'cloud1-d6g5stkeb92288dee',
    userInfo: normalizeUser(wx.getStorageSync('userInfo') || {}),
    defaultAvatar: DEFAULT_AVATAR,
  },
});
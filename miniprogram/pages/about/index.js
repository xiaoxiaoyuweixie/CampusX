Page({
  data: {
    agreements: [
      { key: 'user', title: '用户服务协议' },
      { key: 'privacy', title: '隐私协议' },
      { key: 'platform', title: '平台服务协议' },
    ],
  },

  onAgreementTap(e) {
    const title = e.currentTarget.dataset.title || '协议';
    wx.showToast({
      title: `${title}内容准备中`,
      icon: 'none',
    });
  },
});

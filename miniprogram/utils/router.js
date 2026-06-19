// 简易路由跳转辅助
function toDetail(id) {
  wx.navigateTo({ url: `/pages/detail/index?id=${id}` });
}
function toChat(userId, name) {
  wx.navigateTo({ url: `/pages/chat/index?userId=${userId}&name=${encodeURIComponent(name || '')}` });
}
function toast(title, icon = 'none') {
  wx.showToast({ title, icon, duration: 1500 });
}
function comingSoon() {
  wx.showToast({ title: '功能开发中', icon: 'none' });
}
module.exports = { toDetail, toChat, toast, comingSoon };

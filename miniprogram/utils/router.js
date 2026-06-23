let detailNavigating = false;

function toDetail(id) {
  const safeId = id == null ? '' : String(id).trim();
  if (!safeId || safeId === 'undefined' || safeId === 'null') {
    wx.showToast({ title: '商品信息加载失败', icon: 'none' });
    return;
  }

  if (detailNavigating) return;
  detailNavigating = true;
  wx.navigateTo({
    url: `/pages/detail/index?id=${encodeURIComponent(safeId)}`,
    complete: () => {
      setTimeout(() => {
        detailNavigating = false;
      }, 500);
    },
  });
}

function toChat(userId, name, productId = '') {
  wx.navigateTo({
    url: `/pages/chat/index?userId=${userId}&name=${encodeURIComponent(name || '')}&productId=${productId}`,
  });
}

function toChatSession(sessionId) {
  wx.navigateTo({ url: `/pages/chat/index?sessionId=${sessionId}` });
}

function toast(title, icon = 'none') {
  wx.showToast({ title, icon, duration: 1500 });
}

function comingSoon() {
  wx.showToast({ title: '功能开发中', icon: 'none' });
}

module.exports = { toDetail, toChat, toChatSession, toast, comingSoon };

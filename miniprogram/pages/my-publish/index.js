const { api } = require('../../api/index.js');

const TABS = [
  { key: 'on_sale', name: '在售' },
  { key: 'off_shelf', name: '已下架' },
  { key: 'sold', name: '已售出' },
];

Page({
  data: {
    tabs: TABS,
    activeTab: 'on_sale',
    list: [],
    allList: [],
    onsaleCount: 0,
    offlineCount: 0,
    soldCount: 0,
  },

  onShow() {
    this.loadList();
  },

  async loadList() {
    const res = await api.getMyProducts({ page: 1, pageSize: 50 });
    const payload = res.result || {};
    if (payload.code !== 0) {
      wx.showToast({ title: payload.message || '加载失败', icon: 'none' });
      return;
    }

    const mine = (payload.data.list || []).map(item => ({
      ...item,
      id: item.productId || item.id || item._id,
      cover: item.cover || (item.images && item.images[0]) || '',
      favorites: item.favoriteCount == null ? (item.favorites || 0) : item.favoriteCount,
      views: item.viewCount == null ? (item.views || 0) : item.viewCount,
    }));
    const onsale = mine.filter(i => i.status === 'on_sale').length;
    const offline = mine.filter(i => i.status === 'off_shelf').length;
    const sold = mine.filter(i => i.status === 'sold').length;
    this.setData({
      allList: mine,
      onsaleCount: onsale,
      offlineCount: offline,
      soldCount: sold,
    });
    this.filterList(this.data.activeTab, mine);
  },

  filterList(key, source) {
    const all = source || this.data.allList;
    const list = all.filter(i => i.status === key);
    this.setData({ list, activeTab: key });
  },

  onTabTap(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.activeTab) return;
    this.filterList(key);
  },

  onCardTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/index?id=${id}` });
  },

  onToggleStatus(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.allList.find((it) => it.id === id);
    if (!item || item.status === 'sold') return;

    const isOnline = item.status === 'on_sale';
    const nextStatus = isOnline ? 'off_shelf' : 'on_sale';
    wx.showModal({
      title: '提示',
      content: isOnline ? '确认将该资源下架吗？' : '确认将该资源恢复上架吗？',
      confirmText: isOnline ? '确认下架' : '确认恢复',
      confirmColor: isOnline ? '#EF4444' : '#16A34A',
      success: async (res) => {
        if (!res.confirm) return;
        await this.updateStatus(id, nextStatus, isOnline ? '已下架' : '已恢复');
      },
    });
  },

  onMarkSold(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.allList.find((it) => it.id === id);
    if (!item || item.status !== 'on_sale') return;

    wx.showModal({
      title: '提示',
      content: '确认将该资源标记为已售出吗？',
      confirmText: '确认售出',
      confirmColor: '#16A34A',
      success: async (res) => {
        if (!res.confirm) return;
        await this.updateStatus(id, 'sold', '已标记售出');
      },
    });
  },

  async updateStatus(productId, status, successText) {
    const updateRes = await api.updateProductStatus({ productId, status });
    const payload = updateRes.result || {};
    if (payload.code !== 0) {
      wx.showToast({ title: payload.message || '操作失败', icon: 'none' });
      return;
    }
    wx.showToast({ title: successText, icon: 'success' });
    this.loadList();
  },

  onGoPublish() {
    wx.switchTab({ url: '/pages/publish/index' });
  },
});

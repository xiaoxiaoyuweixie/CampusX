const storage = require('../../utils/storage.js');

const TABS = [
  { key: 'all', name: '全部' },
  { key: 'onsale', name: '在售' },
  { key: 'offline', name: '已下架' },
];

Page({
  data: {
    tabs: TABS,
    activeTab: 'all',
    list: [],
    allList: [],
    total: 0,
    onsaleCount: 0,
    offlineCount: 0,
  },

  onShow() {
    this.loadList();
  },

  loadList() {
    const mine = storage.get('myPublished', []).map(item => ({
      ...item,
      status: item.status || 'onsale',
      favorites: item.favorites == null ? Math.floor((item.views || 0) / 8) : item.favorites,
    }));
    const onsale = mine.filter(i => i.status === 'onsale').length;
    const offline = mine.length - onsale;
    this.setData({
      allList: mine,
      total: mine.length,
      onsaleCount: onsale,
      offlineCount: offline,
    });
    this.filterList(this.data.activeTab, mine);
  },

  filterList(key, source) {
    const all = source || this.data.allList;
    const list = key === 'all' ? all : all.filter(i => i.status === key);
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

  onEdit(e) {
    const id = e.currentTarget.dataset.id;

    setTimeout(() => {
      wx.switchTab({ url: '/pages/publish/index' });
    }, 600);
  },

  onToggleStatus(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.allList.find((it) => it.id === id);
    if (!item) return;

    const isOnline = item.status === 'onsale';
    wx.showModal({
      title: '提示',
      content: isOnline ? '确认将该资源下架吗？' : '确认将该资源恢复上架吗？',
      confirmText: isOnline ? '确认下架' : '确认恢复',
      confirmColor: isOnline ? '#EF4444' : '#16A34A',
      success: (res) => {
        if (!res.confirm) return;
        const mine = storage.get('myPublished', []).map((it) => (
          it.id === id ? { ...it, status: isOnline ? 'offline' : 'onsale' } : it
        ));
        storage.set('myPublished', mine);
        wx.showToast({ title: isOnline ? '已下架' : '已恢复', icon: 'success' });
        this.loadList();
      },
    });
  },

  onGoPublish() {
    wx.switchTab({ url: '/pages/publish/index' });
  },
});

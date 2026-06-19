const storage = require('../../utils/storage.js');
const { products } = require('../../mock/products.js');

// 分类 -> 收藏 Tab 类型
const CATEGORY_TYPE = {
  digital: 'goods',
  dorm: 'goods',
  book: 'doc',
  kaoyan: 'doc',
  skill: 'service',
};

const TABS = [
  { key: 'all', name: '全部' },
  { key: 'goods', name: '商品' },
  { key: 'doc', name: '资料' },
  { key: 'service', name: '服务' },
];

Page({
  data: {
    tabs: TABS,
    activeTab: 'all',
    list: [],
    allList: [],
    total: 0,
  },

  onShow() {
    this.loadFavorites();
  },

  loadFavorites() {
    const favIds = storage.getFavorites();
    const all = products
      .filter(p => favIds.includes(p.id))
      .map(p => ({
        ...p,
        type: CATEGORY_TYPE[p.category] || 'goods',
      }));
    this.setData({ allList: all, total: all.length });
    this.filterList(this.data.activeTab, all);
  },

  filterList(key, source) {
    const all = source || this.data.allList;
    const list = key === 'all' ? all : all.filter(item => item.type === key);
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

  onUnfavorite(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '提示',
      content: '确认取消收藏？',
      confirmColor: '#3B82F6',
      success: (res) => {
        if (res.confirm) {
          storage.toggleFavorite(id);
          wx.showToast({ title: '已取消收藏', icon: 'none' });
          this.loadFavorites();
        }
      },
    });
  },

  onGoHome() {
    wx.switchTab({ url: '/pages/home/index' });
  },
});

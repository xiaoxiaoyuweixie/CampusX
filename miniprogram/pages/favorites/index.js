const { api } = require('../../api/index.js');
const router = require('../../utils/router.js');

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

  async loadFavorites() {
    const res = await api.listFavorites({ page: 1, pageSize: 50 });
    const payload = res.result || {};
    if (payload.code !== 0) {
      wx.showToast({ title: payload.message || '加载失败', icon: 'none' });
      return;
    }

    const all = (payload.data.list || []).map(item => ({
      ...item,
      id: item.productId || item.id || item._id,
      cover: item.cover || (item.images && item.images[0]) || '',
      type: CATEGORY_TYPE[item.categoryId || item.category] || 'goods',
    }));
    this.setData({ allList: all, total: payload.data.total || all.length });
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
    router.toDetail(id);
  },

  onUnfavorite(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '提示',
      content: '确认取消收藏？',
      confirmColor: '#3B82F6',
      success: async (res) => {
        if (!res.confirm) return;
        const removeRes = await api.removeFavorite(id);
        const payload = removeRes.result || {};
        if (payload.code !== 0) {
          wx.showToast({ title: payload.message || '取消失败', icon: 'none' });
          return;
        }
        wx.showToast({ title: '已取消收藏', icon: 'none' });
        this.loadFavorites();
      },
    });
  },

  onGoHome() {
    wx.switchTab({ url: '/pages/home/index' });
  },
});

const router = require('../../utils/router.js');
const { api } = require('../../api/index.js');
const { categories: fallbackCategories } = require('../../mock/products.js');

const FALLBACK_COVER = 'https://upload.wikimedia.org/wikipedia/commons/3/3f/Fronalpstock_big.jpg';

Page({
  data: {
    school: '西南大学',
    keyword: '',
    categories: [],
    products: [],
  },
  async onLoad() {
    await Promise.all([this.loadCategories(), this.loadProducts()]);
  },
  async onShow() {
    await this.loadProducts(this.data.keyword);
  },
  async loadCategories() {
    try {
      const res = await api.getCategories();
      const payload = res.result || {};
      if (payload.code === 0 && payload.data && payload.data.length) {
        this.setData({ categories: payload.data });
        return;
      }
    } catch (err) {}

    this.setData({ categories: fallbackCategories });
  },
  async loadProducts(keyword = '') {
    const request = keyword
      ? api.listProducts({ keyword, page: 1, pageSize: 20, status: 'on_sale' })
      : api.getRecommendedProducts({ page: 1, pageSize: 20 });
    const res = await request;
    const payload = res.result || {};
    if (payload.code === 0) {
      const list = (payload.data.list || []).map(item => ({
        ...item,
        id: item.id || item._id,
        cover: item.cover || (item.images && item.images[0]) || FALLBACK_COVER,
      }));
      this.setData({ products: list });
    }
  },
  onPullDownRefresh() {
    this.loadProducts(this.data.keyword).finally(() => wx.stopPullDownRefresh());
  },
  onSearchInput(e) { this.setData({ keyword: e.detail.value }); },
  onSearchConfirm(e) {
    const kw = (e.detail.value || '').trim();
    this.setData({ keyword: kw });
    this.loadProducts(kw);
  },
  onSearchCancel() {
    this.setData({ keyword: '' });
    this.loadProducts('');
  },
  onCategoryTap(e) {
    const id = e.currentTarget.dataset.id;
    getApp().globalData.selectedCategory = id;
    wx.switchTab({ url: '/pages/category/index' });
  },
  onProductTap(e) {
    router.toDetail(e.detail.id);
  },
});

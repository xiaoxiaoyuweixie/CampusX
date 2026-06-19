const { products, categories } = require('../../mock/products.js');
const router = require('../../utils/router.js');

Page({
  data: {
    school: '西南大学',
    keyword: '',
    categories,
    products: [],
  },
  onLoad() {
    this.setData({ products });
  },
  onPullDownRefresh() {
    setTimeout(() => {
      this.setData({ products: [...products] });
      wx.stopPullDownRefresh();
    }, 500);
  },
  onSearchInput(e) { this.setData({ keyword: e.detail.value }); },
  onSearchConfirm(e) {
    const kw = (e.detail.value || '').trim();
    if (!kw) { this.setData({ products }); return; }
    const list = products.filter(p => p.title.includes(kw));
    this.setData({ products: list });
  },
  onCategoryTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.switchTab({ url: '/pages/category/index' });
    // 通过全局简单方式传递所选分类
    getApp().globalData.selectedCategory = id;
  },
  onProductTap(e) {
    router.toDetail(e.detail.id);
  },
});

const { products, categories } = require('../../mock/products.js');
const router = require('../../utils/router.js');

Page({
  data: {
    categories,
    activeId: 'digital',
    sort: 'composite', // composite | newest | price
    list: [],
  },
  onShow() {
    const g = getApp().globalData;
    if (g.selectedCategory) {
      this.setData({ activeId: g.selectedCategory });
      g.selectedCategory = null;
    }
    this.refresh();
  },
  onCatTap(e) {
    this.setData({ activeId: e.currentTarget.dataset.id }, () => this.refresh());
  },
  onSortTap(e) {
    this.setData({ sort: e.currentTarget.dataset.sort }, () => this.refresh());
  },
  refresh() {
    let list = products.filter(p => p.category === this.data.activeId);
    if (this.data.sort === 'price') list = [...list].sort((a, b) => a.price - b.price);
    if (this.data.sort === 'newest') list = [...list].reverse();
    this.setData({ list });
  },
  onProductTap(e) { router.toDetail(e.detail.id); },
});

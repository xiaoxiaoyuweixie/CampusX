const router = require('../../utils/router.js');
const { api } = require('../../api/index.js');
const { categories: fallbackCategories } = require('../../mock/products.js');

Page({
  data: {
    categories: [],
    activeId: 'digital',
    sort: 'composite',
    list: [],
  },

  async onShow() {
    const g = getApp().globalData;
    await this.loadCategories();
    if (g.selectedCategory) {
      this.setData({ activeId: g.selectedCategory });
      g.selectedCategory = null;
    } else if (!this.data.activeId && this.data.categories.length) {
      this.setData({ activeId: this.data.categories[0].id });
    }
    await this.refresh();
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

  onCatTap(e) {
    this.setData({ activeId: e.currentTarget.dataset.id }, () => this.refresh());
  },

  onSortTap(e) {
    this.setData({ sort: e.currentTarget.dataset.sort }, () => this.refresh());
  },

  async refresh() {
    const res = await api.listProducts({
      category: this.data.activeId,
      sort: this.data.sort,
      status: 'on_sale',
      page: 1,
      pageSize: 50,
    });
    const payload = res.result || {};
    if (payload.code !== 0) {
      this.setData({ list: [] });
      return;
    }
    let list = payload.data.list || [];
    if (this.data.sort === 'price') list = [...list].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    this.setData({ list });
  },

  onProductTap(e) {
    router.toDetail(e.detail.id);
  },
});

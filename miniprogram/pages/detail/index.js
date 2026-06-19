const { products } = require('../../mock/products.js');
const storage = require('../../utils/storage.js');
const router = require('../../utils/router.js');

Page({
  data: {
    product: null,
    favorited: false,
    current: 0,
  },
  onLoad(options) {
    const id = Number(options.id);
    const all = [...storage.get('myPublished', []), ...products];
    const product = all.find(p => p.id === id) || products[0];
    this.setData({
      product,
      favorited: storage.isFavorite(product.id),
    });
  },
  onSwiperChange(e) { this.setData({ current: e.detail.current }); },
  onToggleFav() {
    const fav = storage.toggleFavorite(this.data.product.id);
    this.setData({ favorited: fav });
    wx.showToast({ title: fav ? '已收藏' : '已取消', icon: 'none' });
  },
  onContact() {
    const { sellerId, sellerName } = this.data.product;
    router.toChat(sellerId, sellerName);
  },
});

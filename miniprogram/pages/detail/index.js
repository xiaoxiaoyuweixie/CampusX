const storage = require('../../utils/storage.js');
const router = require('../../utils/router.js');
const { api } = require('../../api/index.js');

const FALLBACK_COVER = 'https://upload.wikimedia.org/wikipedia/commons/3/3f/Fronalpstock_big.jpg';

Page({
  data: {
    product: null,
    favorited: false,
    current: 0,
  },
  async onLoad(options) {
    const id = options.id;
    const res = await api.getProductDetail(id);
    const payload = res.result || {};
    if (payload.code === 0) {
      const product = {
        ...payload.data,
        cover: payload.data.cover || (payload.data.images && payload.data.images[0]) || FALLBACK_COVER,
      };
      this.setData({ product });
      const favRes = await api.checkFavorite(id);
      const favPayload = favRes.result || {};
      this.setData({ favorited: favPayload.code === 0 ? !!favPayload.data.favorited : false });
    }
  },
  onSwiperChange(e) { this.setData({ current: e.detail.current }); },
  async onToggleFav() {
    const { product, favorited } = this.data;
    if (!product) return;
    const res = favorited ? await api.removeFavorite(product._id || product.id) : await api.addFavorite(product._id || product.id);
    const payload = res.result || {};
    if (payload.code === 0) {
      this.setData({ favorited: !favorited });
      wx.showToast({ title: !favorited ? '已收藏' : '已取消', icon: 'none' });
    }
  },
  onContact() {
    const { userId, sellerName, _id } = this.data.product || {};
    router.toChat(userId, sellerName, _id);
  },
});

const storage = require('../../utils/storage.js');
const router = require('../../utils/router.js');
const { api } = require('../../api/index.js');
const { products: mockProducts } = require('../../mock/products.js');

const FALLBACK_COVER = 'https://upload.wikimedia.org/wikipedia/commons/3/3f/Fronalpstock_big.jpg';

function normalizeProduct(raw) {
  if (!raw) return null;
  const cover = raw.cover || (raw.images && raw.images[0]) || FALLBACK_COVER;
  const images = Array.isArray(raw.images) && raw.images.length ? raw.images : [cover];
  return {
    ...raw,
    id: raw.id || raw._id,
    cover,
    images,
    sellerName: raw.sellerName || raw.nickname || '发布者',
    userId: raw.userId || raw.sellerId || raw.openid || '',
    views: raw.views || 0,
  };
}

Page({
  data: {
    product: null,
    favorited: false,
    current: 0,
    loadFailed: false,
  },
  async onLoad(options) {
    const id = options.id;
    if (!id || id === 'undefined') {
      this.setData({ loadFailed: true });
      return;
    }

    let product = null;
    try {
      const res = await api.getProductDetail(id);
      const payload = res.result || {};
      if (payload.code === 0 && payload.data) {
        product = normalizeProduct(payload.data.product || payload.data);
      }
    } catch (err) {}

    if (!product) {
      product = normalizeProduct(mockProducts.find(item => String(item.id) === String(id)));
    }

    if (!product) {
      this.setData({ loadFailed: true });
      return;
    }

    this.setData({ product, loadFailed: false });

    try {
      const favRes = await api.checkFavorite(product.productId || product._id || product.id);
      const favPayload = favRes.result || {};
      this.setData({ favorited: favPayload.code === 0 ? !!favPayload.data.favorited : false });
    } catch (err) {
      this.setData({ favorited: storage.isFavorite(product.productId || product.id) });
    }
  },
  onSwiperChange(e) { this.setData({ current: e.detail.current }); },
  async onToggleFav() {
    const { product, favorited } = this.data;
    if (!product) return;
    const productId = product.productId || product._id || product.id;
    const res = favorited ? await api.removeFavorite(productId) : await api.addFavorite(productId);
    const payload = res.result || {};
    if (payload.code === 0) {
      this.setData({ favorited: !favorited });
      wx.showToast({ title: !favorited ? '已收藏' : '已取消', icon: 'none' });
    }
  },
  onContact() {
    const { userId, sellerName, _id, id } = this.data.product || {};
    router.toChat(userId, sellerName, _id || id);
  },
});

const router = require('../../utils/router.js');
const { api } = require('../../api/index.js');
const { products: mockProducts } = require('../../mock/products.js');

const FALLBACK_COVER = 'https://upload.wikimedia.org/wikipedia/commons/3/3f/Fronalpstock_big.jpg';

function decodeId(value) {
  if (!value) return '';
  try {
    return decodeURIComponent(String(value));
  } catch (err) {
    return String(value);
  }
}

function normalizeProduct(raw) {
  if (!raw) return null;
  const cover = raw.cover || (raw.images && raw.images[0]) || FALLBACK_COVER;
  const images = Array.isArray(raw.images) && raw.images.length ? raw.images : [cover];
  return {
    ...raw,
    id: raw.id || raw._id || raw.productId,
    productId: raw.productId || raw.id || raw._id,
    cover,
    images,
    sellerName: raw.sellerName || raw.nickname || '发布者',
    sellerAvatar: raw.sellerAvatar || raw.avatar || '',
    userId: raw.userId || raw.sellerId || raw.openid || '',
    views: raw.views || raw.viewCount || 0,
  };
}

Page({
  data: {
    product: null,
    favorited: false,
    current: 0,
    loadFailed: false,
    contacting: false,
    favoriteSubmitting: false,
  },

  async onLoad(options) {
    const rawId = options.id || options.productId;
    const id = decodeId(rawId).trim();
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
      if (favPayload.code !== 0) {
        wx.showToast({ title: favPayload.message || '收藏状态加载失败', icon: 'none' });
        return;
      }
      this.setData({ favorited: !!(favPayload.data && favPayload.data.favorited) });
    } catch (err) {
      wx.showToast({ title: '收藏状态加载失败', icon: 'none' });
    }
  },

  onSwiperChange(e) {
    this.setData({ current: e.detail.current });
  },

  async onToggleFav() {
    const { product, favorited, favoriteSubmitting } = this.data;
    if (!product || favoriteSubmitting) return;
    const productId = product.productId || product._id || product.id;
    this.setData({ favoriteSubmitting: true });
    try {
      const res = favorited ? await api.removeFavorite(productId) : await api.addFavorite(productId);
      const payload = res.result || {};
      if (payload.code !== 0) {
        wx.showToast({ title: payload.message || '收藏操作失败', icon: 'none' });
        return;
      }
      const nextFavorited = payload.data && typeof payload.data.favorited === 'boolean'
        ? payload.data.favorited
        : !favorited;
      this.setData({ favorited: nextFavorited });
      wx.showToast({ title: nextFavorited ? '已收藏' : '已取消', icon: 'none' });
    } catch (err) {
      wx.showToast({ title: '收藏操作失败', icon: 'none' });
    } finally {
      this.setData({ favoriteSubmitting: false });
    }
  },

  async onContact() {
    const { product, contacting } = this.data;
    if (!product || contacting) return;
    const productId = product.productId || product._id || product.id;
    this.setData({ contacting: true });
    wx.showLoading({ title: '正在进入聊天' });
    try {
      const res = await api.openChatSession(productId);
      const payload = res.result || {};
      if (payload.code !== 0 || !payload.data || !payload.data.sessionId) {
        wx.showToast({ title: payload.message || '暂时无法联系发布者', icon: 'none' });
        return;
      }
      router.toChatSession(payload.data.sessionId);
    } catch (err) {
      wx.showToast({ title: '暂时无法联系发布者', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ contacting: false });
    }
  },
});

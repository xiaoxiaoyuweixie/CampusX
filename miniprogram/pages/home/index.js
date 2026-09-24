const router = require('../../utils/router.js');
const { api } = require('../../api/index.js');
const unread = require('../../utils/unread.js');
const { withCategoryIcons } = require('../../utils/category-presentation.js');
const { categories: fallbackCategories } = require('../../mock/products.js');

const FALLBACK_COVER = 'https://upload.wikimedia.org/wikipedia/commons/3/3f/Fronalpstock_big.jpg';
const ASSISTANT_BUTTON_SIZE_RPX = 112;
const ASSISTANT_MARGIN_RPX = 28;
const ASSISTANT_DRAG_THRESHOLD_PX = 8;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function rpxToPx(rpx, windowWidth) {
  return rpx * windowWidth / 750;
}

Page({
  data: {
    school: '西南大学',
    keyword: '',
    categories: [],
    products: [],
    assistantReady: false,
    assistantX: 0,
    assistantY: 0,
    assistantOpen: false,
    assistantInput: '',
    assistantMessages: [
      {
        id: 'assistant-welcome',
        role: 'assistant',
        content: '你好，我是 CampusX AI 助手。可以向我咨询平台规则，也可以让我查找在售校园资源。',
      },
    ],
    assistantReplying: false,
    assistantScrollIntoView: 'assistant-welcome',
  },

  assistantBounds: null,
  assistantDragStart: null,
  assistantDragMoved: false,
  assistantRequestId: 0,

  async onLoad() {
    this.setupAssistantPosition();
    await Promise.all([this.loadCategories(), this.loadProducts()]);
  },
  async onShow() {
    unread.refresh();
    await this.loadProducts(this.data.keyword);
  },
  onHide() {
    this.closeAssistant();
  },
  onResize(size) {
    this.setupAssistantPosition(size);
  },
  onUnload() {
    this.closeAssistant();
    this.assistantRequestId += 1;
  },
  async loadCategories() {
    try {
      const res = await api.getCategories();
      const payload = res.result || {};
      if (payload.code === 0 && payload.data && payload.data.length) {
        this.setData({ categories: withCategoryIcons(payload.data) });
        return;
      }
    } catch (err) {}

    this.setData({ categories: withCategoryIcons(fallbackCategories) });
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
  setupAssistantPosition(size = {}) {
    let windowInfo = size.size || size;
    if (!windowInfo.windowWidth || !windowInfo.windowHeight) {
      windowInfo = typeof wx.getWindowInfo === 'function'
        ? wx.getWindowInfo()
        : wx.getSystemInfoSync();
    }

    const buttonSize = rpxToPx(ASSISTANT_BUTTON_SIZE_RPX, windowInfo.windowWidth);
    const margin = rpxToPx(ASSISTANT_MARGIN_RPX, windowInfo.windowWidth);
    const maxX = Math.max(0, windowInfo.windowWidth - buttonSize);
    const maxY = Math.max(0, windowInfo.windowHeight - buttonSize);
    this.assistantBounds = { maxX, maxY };

    const assistantX = this.data.assistantReady
      ? clamp(this.data.assistantX, 0, maxX)
      : Math.max(0, maxX - margin);
    const assistantY = this.data.assistantReady
      ? clamp(this.data.assistantY, 0, maxY)
      : Math.max(0, maxY - margin);

    this.setData({ assistantReady: true, assistantX, assistantY });
  },
  onAssistantTouchStart(e) {
    const touch = e.touches && e.touches[0];
    if (!touch) return;
    this.assistantDragMoved = false;
    this.assistantDragStart = {
      clientX: touch.clientX,
      clientY: touch.clientY,
      assistantX: this.data.assistantX,
      assistantY: this.data.assistantY,
    };
  },
  onAssistantTouchMove(e) {
    const touch = e.touches && e.touches[0];
    const start = this.assistantDragStart;
    const bounds = this.assistantBounds;
    if (!touch || !start || !bounds) return;

    const offsetX = touch.clientX - start.clientX;
    const offsetY = touch.clientY - start.clientY;
    if (Math.abs(offsetX) > ASSISTANT_DRAG_THRESHOLD_PX || Math.abs(offsetY) > ASSISTANT_DRAG_THRESHOLD_PX) {
      this.assistantDragMoved = true;
    }

    this.setData({
      assistantX: clamp(start.assistantX + offsetX, 0, bounds.maxX),
      assistantY: clamp(start.assistantY + offsetY, 0, bounds.maxY),
    });
  },
  onAssistantTouchEnd(e) {
    const start = this.assistantDragStart;
    const touch = e.changedTouches && e.changedTouches[0];
    const movedOnEnd = start && touch && (
      Math.abs(touch.clientX - start.clientX) > ASSISTANT_DRAG_THRESHOLD_PX
      || Math.abs(touch.clientY - start.clientY) > ASSISTANT_DRAG_THRESHOLD_PX
    );
    const shouldOpen = start && !this.assistantDragMoved && !movedOnEnd;
    this.assistantDragStart = null;
    this.assistantDragMoved = false;
    if (!shouldOpen) return;

    const messages = this.data.assistantMessages;
    const latestMessage = messages[messages.length - 1];
    wx.hideTabBar({ animation: false });
    this.setData({
      assistantOpen: true,
      assistantScrollIntoView: latestMessage ? latestMessage.id : '',
    });
  },
  onAssistantTouchCancel() {
    this.assistantDragStart = null;
    this.assistantDragMoved = false;
  },
  onAssistantClose() {
    this.closeAssistant();
  },
  closeAssistant() {
    if (!this.data.assistantOpen) return;
    wx.showTabBar({ animation: false });
    this.setData({ assistantOpen: false });
  },
  onAssistantSheetTap() {},
  onAssistantInput(e) {
    this.setData({ assistantInput: e.detail.value });
  },
  async onAssistantSend() {
    const content = this.data.assistantInput.trim();
    if (!content || this.data.assistantReplying) return;

    const userMessage = {
      id: `assistant-user-${Date.now()}`,
      role: 'user',
      content,
    };
    const messages = [...this.data.assistantMessages, userMessage];
    const requestId = ++this.assistantRequestId;
    this.setData({
      assistantMessages: messages,
      assistantInput: '',
      assistantReplying: true,
      assistantScrollIntoView: 'assistant-replying',
    });

    try {
      const res = await api.aiAssistantChat({
        messages: messages.map(item => ({ role: item.role, content: item.content })),
      });
      if (requestId !== this.assistantRequestId) return;

      const payload = res.result || {};
      if (payload.code !== 0) {
        const error = new Error(payload.message || 'AI助手暂时不可用，请稍后再试');
        error.userMessage = payload.message;
        throw error;
      }

      const data = payload.data || {};
      const sources = Array.isArray(data.sources) ? data.sources : [];
      const products = Array.isArray(data.products)
        ? data.products
          .map(product => ({
            ...product,
            id: product.id || product._id,
            cover: product.cover || FALLBACK_COVER,
          }))
          .filter(product => product.id)
        : [];
      const sourceText = [...new Set(sources.map(item => item && item.title).filter(Boolean))].join('、');
      const assistantMessage = {
        id: `assistant-reply-${Date.now()}`,
        role: 'assistant',
        content: data.content || '暂无相关规则',
        sourceText,
        products,
      };
      this.setData({
        assistantMessages: [...this.data.assistantMessages, assistantMessage],
        assistantReplying: false,
        assistantScrollIntoView: assistantMessage.id,
      });
    } catch (error) {
      if (requestId !== this.assistantRequestId) return;
      const assistantMessage = {
        id: `assistant-error-${Date.now()}`,
        role: 'assistant',
        content: error.userMessage || 'AI助手暂时不可用，请稍后再试',
      };
      this.setData({
        assistantMessages: [...this.data.assistantMessages, assistantMessage],
        assistantReplying: false,
        assistantScrollIntoView: assistantMessage.id,
      });
    }
  },
  onAssistantProductTap(e) {
    router.toDetail(e.currentTarget.dataset.id);
  },
});

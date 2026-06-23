const { api } = require('../../api/index.js');
const { categories: fallbackCategories } = require('../../mock/products.js');

Page({
  data: {
    images: [],
    title: '',
    desc: '',
    price: '',
    location: '',
    categories: [],
    categoryIndex: 0,
    submitting: false,
  },

  async onLoad() {
    await this.loadCategories();
  },

  async loadCategories() {
    try {
      const res = await api.getCategories();
      const payload = res.result || {};
      if (payload.code === 0 && payload.data && payload.data.length) {
        this.setData({ categories: payload.data, categoryIndex: 0 });
        return;
      }
    } catch (err) {}

    this.setData({ categories: fallbackCategories, categoryIndex: 0 });
  },

  onChooseImage() {
    wx.chooseMedia({
      count: 9 - this.data.images.length,
      mediaType: ['image'],
      success: (res) => {
        const paths = res.tempFiles.map(f => f.tempFilePath);
        this.setData({ images: [...this.data.images, ...paths] });
      },
    });
  },

  onRemoveImage(e) {
    const i = e.currentTarget.dataset.index;
    const imgs = [...this.data.images];
    imgs.splice(i, 1);
    this.setData({ images: imgs });
  },

  onInput(e) {
    const f = e.currentTarget.dataset.field;
    this.setData({ [f]: e.detail.value });
  },

  onCategoryChange(e) {
    this.setData({ categoryIndex: Number(e.detail.value) });
  },

  resetForm() {
    this.setData({
      images: [],
      title: '',
      desc: '',
      price: '',
      location: '',
      categoryIndex: 0,
    });
  },

  getFileExt(filePath) {
    const match = String(filePath || '').match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    return match ? match[1].toLowerCase() : 'jpg';
  },

  uploadProductImage(filePath, productKey, index) {
    return new Promise((resolve, reject) => {
      wx.cloud.uploadFile({
        cloudPath: `product/${productKey}_${Date.now()}_${index}.${this.getFileExt(filePath)}`,
        filePath,
        success: res => resolve(res.fileID),
        fail: reject,
      });
    });
  },

  async uploadProductImages(images) {
    const cloudImages = images.filter(path => String(path).startsWith('cloud://'));
    const localImages = images.filter(path => !String(path).startsWith('cloud://'));
    const productKey = `P${Date.now()}`;
    const uploaded = [];

    for (let i = 0; i < localImages.length; i += 1) {
      uploaded.push(await this.uploadProductImage(localImages[i], productKey, i));
    }

    return [...cloudImages, ...uploaded];
  },

  validateForm() {
    const { title, desc, price, location, images, categories } = this.data;
    const validImages = images.filter(Boolean);
    const amount = Number(price);

    if (!validImages.length) return '请至少上传一张商品图片';
    if (!title.trim()) return '请输入商品标题';
    if (!categories.length) return '请选择商品分类';
    if (!Number.isFinite(amount) || amount < 0) return '请输入正确的价格';
    if (!location.trim()) return '请输入交易地点';
    if ((desc || '').length > 1000) return '商品描述最多1000字';
    return '';
  },

  async onSubmit() {
    if (this.data.submitting) return;

    const error = this.validateForm();
    if (error) {
      wx.showToast({ title: error, icon: 'none' });
      return;
    }

    const { title, desc, price, location, images, categoryIndex, categories } = this.data;
    const validImages = images.filter(Boolean);
    const category = categories[categoryIndex];

    this.setData({ submitting: true });
    wx.showLoading({ title: '发布中' });

    try {
      const imageList = await this.uploadProductImages(validImages);
      const createRes = await api.createProduct({
        title,
        description: desc,
        desc,
        price: Number(price),
        location,
        campus: location.split('路')[0] || location,
        categoryId: category.categoryId || category.id,
        categoryName: category.name,
        images: imageList,
        status: 'on_sale',
      });
      const payload = createRes.result || {};
      if (payload.code !== 0) {
        wx.showToast({ title: payload.message || '发布失败', icon: 'none' });
        return;
      }

      wx.showToast({ title: '发布成功', icon: 'success' });
      this.resetForm();
      setTimeout(() => {
        wx.switchTab({ url: '/pages/home/index' });
      }, 800);
    } catch (err) {
      wx.showToast({ title: err.message || '发布失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ submitting: false });
    }
  },
});

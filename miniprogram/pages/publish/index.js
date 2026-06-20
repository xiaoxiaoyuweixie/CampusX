const { api } = require('../../api/index.js');

const FALLBACK_COVER = 'https://upload.wikimedia.org/wikipedia/commons/3/3f/Fronalpstock_big.jpg';

Page({
  data: {
    images: [FALLBACK_COVER],
    title: '',
    desc: '',
    price: '',
    location: '',
    categories: [],
    categoryIndex: 0,
  },
  async onLoad() {
    const res = await api.getCategories();
    const payload = res.result || {};
    if (payload.code === 0) this.setData({ categories: payload.data || [] });
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
  async onSubmit() {
    const { title, desc, price, location, images, categoryIndex, categories } = this.data;
    if (!title.trim()) return wx.showToast({ title: '请输入标题', icon: 'none' });
    if (!price) return wx.showToast({ title: '请输入价格', icon: 'none' });
    if (!location.trim()) return wx.showToast({ title: '请输入面交地点', icon: 'none' });
    if (!categories.length) return wx.showToast({ title: '分类加载中', icon: 'none' });

    const imageList = [...images];
    const cover = imageList[0] || FALLBACK_COVER;

    const createRes = await api.createProduct({
      title,
      desc,
      price: Number(price),
      location,
      campus: location.split('·')[0] || location,
      category: categories[categoryIndex].id,
      images: imageList,
      cover,
      status: 'published',
    });
    const payload = createRes.result || {};
    if (payload.code !== 0) {
      wx.showToast({ title: payload.message || '发布失败', icon: 'none' });
      return;
    }

    wx.showToast({ title: '发布成功', icon: 'success' });
    setTimeout(() => {
      wx.switchTab({ url: '/pages/home/index' });
    }, 800);
  },
});

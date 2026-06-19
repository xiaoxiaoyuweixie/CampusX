const { categories } = require('../../mock/products.js');
const storage = require('../../utils/storage.js');

Page({
  data: {
    images: [],
    title: '',
    desc: '',
    price: '',
    location: '',
    categories,
    categoryIndex: 0,
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
  onSubmit() {
    const { title, desc, price, location, images, categoryIndex, categories } = this.data;
    if (!title.trim()) return wx.showToast({ title: '请输入标题', icon: 'none' });
    if (!price) return wx.showToast({ title: '请输入价格', icon: 'none' });
    if (!location.trim()) return wx.showToast({ title: '请输入面交地点', icon: 'none' });

    const newItem = {
      id: Date.now(),
      title,
      desc,
      price: Number(price),
      location,
      campus: location.split('·')[0] || location,
      category: categories[categoryIndex].id,
      cover: images[0] || 'https://images.unsplash.com/photo-1513708927688-890fe41c2e99?w=600',
      images: images.length ? images : ['https://images.unsplash.com/photo-1513708927688-890fe41c2e99?w=800'],
      views: 0,
      sellerName: '我',
      sellerId: 'me',
      publishedAt: '刚刚',
    };
    const mine = storage.get('myPublished', []);
    mine.unshift(newItem);
    storage.set('myPublished', mine);

    wx.showToast({ title: '发布成功', icon: 'success' });
    setTimeout(() => {
      wx.switchTab({ url: '/pages/home/index' });
    }, 800);
  },
});

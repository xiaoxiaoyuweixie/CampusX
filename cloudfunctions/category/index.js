const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const DEFAULT_CATEGORIES = [
  { id: 'digital', categoryId: 'digital', name: '数码电子', icon: '📱', description: '手机、电脑、平板、耳机等数码产品', sort: 1, status: 'enabled' },
  { id: 'kaoyan', categoryId: 'kaoyan', name: '考研资料', icon: '📎', description: '考研书籍、真题、笔记资料', sort: 2, status: 'enabled' },
  { id: 'book', categoryId: 'book', name: '教材书籍', icon: '📚', description: '教材、课本、学习资料', sort: 3, status: 'enabled' },
  { id: 'skill', categoryId: 'skill', name: '技能服务', icon: '🤝', description: '代取快递、摄影、设计、维修等服务', sort: 4, status: 'enabled' },
  { id: 'dorm', categoryId: 'dorm', name: '宿舍用品', icon: '🛏️', description: '生活用品、收纳用品、宿舍电器等', sort: 5, status: 'enabled' },
];

function ok(data = null, message = 'success') {
  return { code: 0, message, data };
}

function fail(message = 'error', code = 50000, data = null) {
  return { code, message, data };
}

function normalizeCategory(category) {
  const categoryId = category.categoryId || category.id;
  return {
    ...category,
    id: categoryId,
    categoryId,
    name: category.name,
    icon: category.icon || '',
    sort: Number(category.sort || 0),
    status: category.status || 'enabled',
  };
}

exports.main = async (event = {}) => {
  try {
    if (event.action !== 'getCategories') return fail('unsupported action', 40001);

    const res = await db.collection('categories')
      .where({ status: 'enabled' })
      .orderBy('sort', 'asc')
      .get();

    if (res.data && res.data.length) {
      return ok(res.data.map(normalizeCategory));
    }

    return ok(DEFAULT_CATEGORIES);
  } catch (err) {
    return ok(DEFAULT_CATEGORIES);
  }
};

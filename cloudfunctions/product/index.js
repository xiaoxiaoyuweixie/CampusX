const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const PRODUCT_STATUS = {
  ON_SALE: 'on_sale',
  OFF_SHELF: 'off_shelf',
  SOLD: 'sold',
};

function ok(data = null, message = 'success') {
  return { code: 0, message, data };
}

function fail(message = 'error', code = 50000, data = null) {
  return { code, message, data };
}

function now() {
  return db.serverDate();
}

function getOpenid() {
  return cloud.getWXContext().OPENID;
}

function createProductId() {
  const d = new Date();
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  const stamp = [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
    pad(d.getHours()),
    pad(d.getMinutes()),
    pad(d.getSeconds()),
  ].join('');
  return `P${stamp}${pad(Math.floor(Math.random() * 10000), 4)}`;
}

function parsePagination(data = {}) {
  const page = Math.max(Number(data.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(data.pageSize || 10), 1), 50);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

async function getCurrentUser(openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data[0] || null;
}

function isDisabledUser(user) {
  return user && user.status === 'disabled';
}

function resolveCategory(data = {}) {
  return {
    categoryId: data.categoryId || data.category || '',
    categoryName: data.categoryName || data.categoryText || data.category || '',
  };
}

function validateProductInput(data = {}) {
  const title = String(data.title || '').trim();
  const price = Number(data.price);
  const location = String(data.location || '').trim();
  const description = String(data.description || data.desc || '').trim();
  const images = Array.isArray(data.images) ? data.images.filter(Boolean) : [];
  const { categoryId, categoryName } = resolveCategory(data);

  if (!title) return '请输入商品标题';
  if (!categoryId && !categoryName) return '请选择商品分类';
  if (!Number.isFinite(price) || price < 0) return '请输入正确的价格';
  if (!location) return '请输入交易地点';
  if (!images.length) return '请至少上传一张商品图片';
  if (images.length > 9) return '商品图片最多上传9张';
  if (description.length > 1000) return '商品描述最多1000字';
  return '';
}

function formatTime(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function normalizeProduct(product = {}, seller = null) {
  const images = Array.isArray(product.images) ? product.images : [];
  const cover = product.cover || images[0] || '';
  const sellerName = product.sellerName || (seller && seller.nickname) || '发布者';
  const sellerAvatar = product.sellerAvatar || (seller && seller.avatar) || '';
  return {
    ...product,
    id: product.productId || product._id,
    productId: product.productId || product._id,
    category: product.categoryId || product.category || '',
    categoryId: product.categoryId || product.category || '',
    categoryName: product.categoryName || product.category || '',
    desc: product.description || product.desc || '',
    description: product.description || product.desc || '',
    cover,
    images,
    views: product.viewCount || product.views || 0,
    viewCount: product.viewCount || product.views || 0,
    favorites: product.favoriteCount || product.favorites || 0,
    favoriteCount: product.favoriteCount || product.favorites || 0,
    sellerId: product.userId || product.openid || '',
    userId: product.userId || product.openid || '',
    sellerName,
    sellerAvatar,
    publishedAt: product.publishedAt || formatTime(product.createdAt),
  };
}

async function ensureOwner(openid, productId) {
  const res = await db.collection('products').where({
    productId,
    openid,
  }).limit(1).get();
  return res.data[0] || null;
}

exports.main = async (event = {}) => {
  try {
    const { action, data = {} } = event;
    const openid = getOpenid();
    const products = db.collection('products');

    if (action === 'createProduct') {
      if (!openid) return fail('请先登录', 40004);
      const user = await getCurrentUser(openid);
      if (!user) return fail('用户不存在，请先登录', 40004);
      if (isDisabledUser(user)) return fail('账号已被禁用，请联系管理员', 40003);

      const error = validateProductInput(data);
      if (error) return fail(error, 40001);

      const productId = createProductId();
      const { categoryId, categoryName } = resolveCategory(data);
      const images = data.images.filter(Boolean);
      const payload = {
        productId,
        openid,
        userId: user.userId || user.openid || openid,
        title: String(data.title).trim(),
        categoryId,
        categoryName,
        category: categoryId,
        price: Number(data.price),
        location: String(data.location).trim(),
        campus: data.campus || '',
        description: String(data.description || data.desc || '').trim(),
        images,
        cover: images[0],
        status: PRODUCT_STATUS.ON_SALE,
        viewCount: 0,
        favoriteCount: 0,
        commentCount: 0,
        sellerName: user.nickname || '',
        sellerAvatar: user.avatar || '',
        createdAt: now(),
        updatedAt: now(),
      };
      const addRes = await products.add({ data: payload });
      return ok({ _id: addRes._id, productId, product: normalizeProduct({ ...payload, _id: addRes._id }, user) });
    }

    if (action === 'listProducts' || action === 'getProductList') {
      const { page, pageSize, skip } = parsePagination(data);
      const query = { status: data.status || PRODUCT_STATUS.ON_SALE };
      const category = data.categoryId || data.category;
      if (category) query.categoryId = category;
      if (data.keyword) query.title = db.RegExp({ regexp: String(data.keyword), options: 'i' });

      const total = (await products.where(query).count()).total;
      const listRes = await products.where(query)
        .orderBy('createdAt', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get();

      return ok({ list: listRes.data.map(item => normalizeProduct(item)), page, pageSize, total });
    }

    if (action === 'getProductDetail') {
      const productId = data.productId || data.id;
      if (!productId) return fail('缺少商品ID', 40001);
      const productRes = await products.where(_.or([{ productId }, { _id: productId }])).limit(1).get();
      const product = productRes.data[0];
      if (!product) return fail('商品不存在', 40400);

      products.doc(product._id).update({ data: { viewCount: _.inc(1), updatedAt: now() } }).catch(() => {});

      let seller = null;
      if (product.openid) {
        const sellerRes = await db.collection('users').where({ openid: product.openid }).limit(1).get();
        seller = sellerRes.data[0] || null;
      }

      const normalized = normalizeProduct({ ...product, viewCount: (product.viewCount || 0) + 1 }, seller);
      return ok({ ...normalized, product: normalized, seller });
    }

    if (action === 'getMyProducts') {
      if (!openid) return fail('请先登录', 40004);
      const user = await getCurrentUser(openid);
      if (!user) return fail('用户不存在，请先登录', 40004);
      if (isDisabledUser(user)) return fail('账号已被禁用，请联系管理员', 40003);

      const { page, pageSize, skip } = parsePagination(data);
      const query = { openid };
      if (data.status && data.status !== 'all') query.status = data.status;
      const total = (await products.where(query).count()).total;
      const listRes = await products.where(query)
        .orderBy('createdAt', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get();
      return ok({ list: listRes.data.map(item => normalizeProduct(item)), page, pageSize, total });
    }

    if (action === 'updateProductStatus') {
      if (!openid) return fail('请先登录', 40004);
      const user = await getCurrentUser(openid);
      if (!user) return fail('用户不存在，请先登录', 40004);
      if (isDisabledUser(user)) return fail('账号已被禁用，请联系管理员', 40003);

      const productId = data.productId || data.id;
      const status = data.status;
      if (![PRODUCT_STATUS.ON_SALE, PRODUCT_STATUS.OFF_SHELF, PRODUCT_STATUS.SOLD].includes(status)) {
        return fail('商品状态不合法', 40001);
      }
      const product = await ensureOwner(openid, productId);
      if (!product) return fail('商品不存在或无权限', 40003);
      await products.doc(product._id).update({ data: { status, updatedAt: now() } });
      return ok(true);
    }

    if (action === 'deleteProduct') {
      if (!openid) return fail('请先登录', 40004);
      const user = await getCurrentUser(openid);
      if (!user) return fail('用户不存在，请先登录', 40004);
      if (isDisabledUser(user)) return fail('账号已被禁用，请联系管理员', 40003);

      const productId = data.productId || data.id;
      const product = await ensureOwner(openid, productId);
      if (!product) return fail('商品不存在或无权限', 40003);
      await products.doc(product._id).update({ data: { status: PRODUCT_STATUS.OFF_SHELF, updatedAt: now() } });
      return ok(true);
    }

    return fail('unsupported action', 40001);
  } catch (err) {
    return fail(err.message || 'product service failed');
  }
};

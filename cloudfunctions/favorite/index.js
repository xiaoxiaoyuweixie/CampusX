const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

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

function parsePagination(data = {}) {
  const page = Math.max(Number(data.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(data.pageSize || 10), 1), 50);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

async function findProduct(productId) {
  if (!productId) return null;
  const res = await db.collection('products')
    .where(_.or([{ productId }, { _id: productId }]))
    .limit(1)
    .get();
  return res.data[0] || null;
}

function normalizeProduct(product = {}) {
  const images = Array.isArray(product.images) ? product.images : [];
  return {
    ...product,
    id: product.productId || product._id,
    productId: product.productId || product._id,
    cover: product.cover || images[0] || '',
    images,
    desc: product.description || product.desc || '',
    views: product.viewCount || 0,
    favorites: product.favoriteCount || 0,
    sellerName: product.sellerName || '发布者',
  };
}

exports.main = async (event = {}) => {
  try {
    const { action, data = {} } = event;
    const openid = getOpenid();
    if (!openid) return fail('请先登录', 40004);

    const favorites = db.collection('favorites');
    const products = db.collection('products');

    if (action === 'addFavorite') {
      const product = await findProduct(data.productId);
      if (!product) return fail('商品不存在', 40400);

      const exists = await favorites.where({ openid, productId: product.productId }).limit(1).get();
      if (!exists.data[0]) {
        await favorites.add({
          data: {
            openid,
            productId: product.productId,
            productDocId: product._id,
            createdAt: now(),
          },
        });
        await products.doc(product._id).update({
          data: { favoriteCount: _.inc(1), updatedAt: now() },
        });
      }
      return ok({ favorited: true });
    }

    if (action === 'removeFavorite') {
      const product = await findProduct(data.productId);
      const productId = product ? product.productId : data.productId;
      const favRes = await favorites.where({ openid, productId }).get();
      if (favRes.data.length) {
        await favorites.where({ openid, productId }).remove();
        if (product) {
          await products.doc(product._id).update({
            data: { favoriteCount: _.inc(-favRes.data.length), updatedAt: now() },
          });
        }
      }
      return ok({ favorited: false });
    }

    if (action === 'checkFavorite') {
      const product = await findProduct(data.productId);
      const productId = product ? product.productId : data.productId;
      const count = await favorites.where({ openid, productId }).count();
      return ok({ favorited: count.total > 0 });
    }

    if (action === 'listFavorites') {
      const { page, pageSize, skip } = parsePagination(data);
      const favRes = await favorites.where({ openid })
        .orderBy('createdAt', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get();
      const ids = favRes.data.map(item => item.productId).filter(Boolean);
      const productRes = ids.length
        ? await products.where({ productId: _.in(ids) }).get()
        : { data: [] };
      const productMap = productRes.data.reduce((map, item) => {
        map[item.productId] = normalizeProduct(item);
        return map;
      }, {});
      const list = ids.map(id => productMap[id]).filter(Boolean);
      const total = (await favorites.where({ openid }).count()).total;
      return ok({ list, page, pageSize, total });
    }

    return fail('unsupported action', 40001);
  } catch (err) {
    return fail(err.message || 'favorite service failed');
  }
};

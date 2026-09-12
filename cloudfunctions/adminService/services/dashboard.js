const { db } = require('../lib/cloud');
const { ok } = require('../lib/response');

async function countSafe(collectionName, query = {}) {
  try {
    return (await db.collection(collectionName).where(query).count()).total || 0;
  } catch (err) {
    return 0;
  }
}

async function getDashboard() {
  const [
    userCount,
    disabledUserCount,
    productCount,
    onSaleCount,
    offShelfCount,
    soldCount,
    categoryCount,
    sessionCount,
    messageCount,
  ] = await Promise.all([
    countSafe('users'),
    countSafe('users', { status: 'disabled' }),
    countSafe('products'),
    countSafe('products', { status: 'on_sale' }),
    countSafe('products', { status: 'off_shelf' }),
    countSafe('products', { status: 'sold' }),
    countSafe('categories'),
    countSafe('chat_sessions'),
    countSafe('chat_messages'),
  ]);

  return ok({
    userCount,
    disabledUserCount,
    productCount,
    onSaleCount,
    offShelfCount,
    soldCount,
    categoryCount,
    sessionCount,
    messageCount,
  });
}

module.exports = { getDashboard };

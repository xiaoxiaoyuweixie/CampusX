const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const DEFAULT_PASSWORD = 'campusx123456';
const TOKEN_SECRET = 'campusx-admin-token-secret-v1';
const TOKEN_TTL = 24 * 60 * 60 * 1000;

function ok(data = null, message = 'success') {
  return { code: 0, message, data };
}

function fail(message = 'error', code = 50000, data = null) {
  return { code, message, data };
}

function httpResponse(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  };
}

function parseHttpEvent(event = {}) {
  if (!event.httpMethod) return null;
  if (event.httpMethod === 'OPTIONS') return { preflight: true };
  const rawBody = event.body || '{}';
  try {
    return typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
  } catch (err) {
    return { action: '', data: {}, parseError: true };
  }
}

function now() {
  return new Date();
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sign(value) {
  return crypto.createHmac('sha256', TOKEN_SECRET).update(value).digest('hex');
}

function createPasswordRecord(password) {
  const salt = crypto.randomBytes(12).toString('hex');
  return {
    salt,
    passwordHash: sha256(`${salt}:${password}`),
  };
}

function verifyPassword(admin, password) {
  return admin.passwordHash === sha256(`${admin.salt}:${password}`);
}

function createToken(admin) {
  const payload = {
    username: admin.username,
    role: admin.role,
    exp: Date.now() + TOKEN_TTL,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

function verifyToken(token = '') {
  const [body, signature] = String(token).split('.');
  if (!body || !signature || sign(body) !== signature) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

function parsePagination(data = {}) {
  const page = Math.max(Number(data.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(data.pageSize || 20), 1), 100);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

async function requireAdmin(data = {}) {
  const payload = verifyToken(data.token);
  if (!payload) return null;
  const res = await db.collection('admins').where({
    username: payload.username,
    status: 'enabled',
    role: 'super_admin',
  }).limit(1).get();
  return res.data[0] || null;
}

async function countSafe(collectionName, query = {}) {
  try {
    return (await db.collection(collectionName).where(query).count()).total || 0;
  } catch (err) {
    return 0;
  }
}

async function initAdmins() {
  const admins = db.collection('admins');
  const total = (await admins.count()).total;
  if (total > 0) return fail('admins_already_initialized', 40001);

  const createdAt = now();
  const records = ['wu', 'xiao'].map(username => {
    const passwordRecord = createPasswordRecord(DEFAULT_PASSWORD);
    return {
      username,
      ...passwordRecord,
      nickname: `超级管理员 ${username}`,
      role: 'super_admin',
      status: 'enabled',
      createdAt,
      updatedAt: createdAt,
      lastLoginAt: null,
    };
  });

  await Promise.all(records.map(record => admins.add({ data: record })));
  return ok({ usernames: records.map(item => item.username) });
}

async function login(data = {}) {
  const username = String(data.username || '').trim();
  const password = String(data.password || '');
  if (!username || !password) return fail('missing_credentials', 40001);

  const res = await db.collection('admins').where({ username }).limit(1).get();
  const admin = res.data[0];
  if (!admin || admin.status !== 'enabled' || !verifyPassword(admin, password)) {
    return fail('invalid_credentials', 40003);
  }

  await db.collection('admins').doc(admin._id).update({
    data: { lastLoginAt: now(), updatedAt: now() },
  });

  return ok({
    token: createToken(admin),
    admin: {
      username: admin.username,
      nickname: admin.nickname,
      role: admin.role,
    },
  });
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

async function listUsers(data = {}) {
  const { page, pageSize, skip } = parsePagination(data);
  const query = {};
  if (data.status) query.status = data.status;
  if (data.keyword) {
    query.nickname = db.RegExp({ regexp: String(data.keyword), options: 'i' });
  }

  const total = (await db.collection('users').where(query).count()).total;
  const res = await db.collection('users')
    .where(query)
    .orderBy('updatedAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get();

  return ok({ list: res.data, page, pageSize, total });
}

async function updateUserStatus(data = {}) {
  const id = data.id || data._id;
  const status = data.status;
  if (!id || !['enabled', 'disabled'].includes(status)) return fail('invalid_user_status', 40001);

  await db.collection('users').doc(id).update({
    data: { status, updatedAt: now() },
  });
  return ok(true);
}

async function listProducts(data = {}) {
  const { page, pageSize, skip } = parsePagination(data);
  const query = {};
  if (data.status) query.status = data.status;
  if (data.categoryId) query.categoryId = data.categoryId;
  if (data.keyword) query.title = db.RegExp({ regexp: String(data.keyword), options: 'i' });

  const total = (await db.collection('products').where(query).count()).total;
  const res = await db.collection('products')
    .where(query)
    .orderBy('updatedAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get();

  return ok({ list: res.data, page, pageSize, total });
}

async function findProductDocId(id) {
  if (!id) return '';
  try {
    const doc = await db.collection('products').doc(id).get();
    if (doc.data && doc.data._id) return doc.data._id;
  } catch (err) {}

  const res = await db.collection('products').where({ productId: id }).limit(1).get();
  return res.data[0] ? res.data[0]._id : '';
}

async function updateProductStatus(data = {}) {
  const status = data.status;
  if (!['on_sale', 'off_shelf', 'sold'].includes(status)) return fail('invalid_product_status', 40001);

  const docId = await findProductDocId(data.id || data.productId);
  if (!docId) return fail('product_not_found', 40400);

  await db.collection('products').doc(docId).update({
    data: { status, updatedAt: now() },
  });
  return ok(true);
}

async function listCategories(data = {}) {
  const { page, pageSize, skip } = parsePagination(data);
  const query = {};
  if (data.status) query.status = data.status;
  const total = (await db.collection('categories').where(query).count()).total;
  const res = await db.collection('categories')
    .where(query)
    .orderBy('sort', 'asc')
    .skip(skip)
    .limit(pageSize)
    .get();
  return ok({ list: res.data, page, pageSize, total });
}

async function findCategoryDocId(id) {
  if (!id) return '';
  try {
    const doc = await db.collection('categories').doc(id).get();
    if (doc.data && doc.data._id) return doc.data._id;
  } catch (err) {}

  const res = await db.collection('categories').where({
    categoryId: id,
  }).limit(1).get();
  return res.data[0] ? res.data[0]._id : '';
}

async function updateCategory(data = {}) {
  const docId = await findCategoryDocId(data.id || data.categoryId);
  if (!docId) return fail('category_not_found', 40400);

  const updates = {};
  ['name', 'icon', 'description', 'status'].forEach(key => {
    if (typeof data[key] === 'string') updates[key] = data[key].trim();
  });
  if (data.sort !== undefined) updates.sort = Number(data.sort) || 0;
  if (!Object.keys(updates).length) return fail('empty_category_update', 40001);
  updates.updatedAt = now();

  await db.collection('categories').doc(docId).update({ data: updates });
  return ok(true);
}

async function listChatSessions(data = {}) {
  const { page, pageSize, skip } = parsePagination(data);
  const query = {};
  if (data.keyword) {
    query.productTitle = db.RegExp({ regexp: String(data.keyword), options: 'i' });
  }
  const total = (await db.collection('chat_sessions').where(query).count()).total;
  const res = await db.collection('chat_sessions')
    .where(query)
    .orderBy('updatedAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get();
  return ok({ list: res.data, page, pageSize, total });
}

async function listChatMessages(data = {}) {
  const sessionId = data.sessionId;
  if (!sessionId) return fail('missing_session_id', 40001);
  const { page, pageSize, skip } = parsePagination(data);
  const total = (await db.collection('chat_messages').where({ sessionId }).count()).total;
  const res = await db.collection('chat_messages')
    .where({ sessionId })
    .orderBy('createdTimestamp', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get();
  return ok({ list: res.data.reverse(), page, pageSize, total });
}

async function handleAction(event = {}) {
  const { action, data = {} } = event;

  if (action === 'initAdmins') return initAdmins();
  if (action === 'login') return login(data);

  const admin = await requireAdmin(data);
  if (!admin) return fail('unauthorized_admin', 40004);

  if (action === 'getDashboard') return getDashboard(data);
  if (action === 'listUsers') return listUsers(data);
  if (action === 'updateUserStatus') return updateUserStatus(data);
  if (action === 'listProducts') return listProducts(data);
  if (action === 'updateProductStatus') return updateProductStatus(data);
  if (action === 'listCategories') return listCategories(data);
  if (action === 'updateCategory') return updateCategory(data);
  if (action === 'listChatSessions') return listChatSessions(data);
  if (action === 'listChatMessages') return listChatMessages(data);

  return fail('unsupported_action', 40001, { action });
}

exports.main = async (event = {}) => {
  const httpEvent = parseHttpEvent(event);
  const isHttp = !!httpEvent;

  try {
    if (httpEvent && httpEvent.preflight) return httpResponse(ok(true));
    if (httpEvent && httpEvent.parseError) return httpResponse(fail('invalid_json_body', 40001), 400);

    const result = await handleAction(isHttp ? httpEvent : event);
    return isHttp ? httpResponse(result) : result;
  } catch (err) {
    const result = fail(err.message || 'admin_service_failed', 50000, {
      name: err.name || '',
      stack: err.stack || '',
    });
    return isHttp ? httpResponse(result, 500) : result;
  }
};

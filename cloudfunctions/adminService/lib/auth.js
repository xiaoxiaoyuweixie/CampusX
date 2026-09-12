const crypto = require('crypto');
const { db } = require('./cloud');
const { fail, ok } = require('./response');
const { now } = require('./time');

// 当前版本不开放初始化管理员功能。
// const DEFAULT_PASSWORD = 'campusx123456';
const TOKEN_SECRET = 'campusx-admin-token-secret-v1';
const TOKEN_TTL = 24 * 60 * 60 * 1000;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sign(value) {
  return crypto.createHmac('sha256', TOKEN_SECRET).update(value).digest('hex');
}

/*
当前版本不开放初始化管理员功能。
function createPasswordRecord(password) {
  const salt = crypto.randomBytes(12).toString('hex');
  return {
    salt,
    passwordHash: sha256(`${salt}:${password}`),
  };
}
*/

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

/*
当前版本不开放初始化管理员功能。
async function initAdmins() {
  const admins = db.collection('admins');
  const total = (await admins.count()).total;
  if (total > 0) return fail('管理员已初始化，请直接登录', 40001);

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
*/

async function login(data = {}) {
  const username = String(data.username || '').trim();
  const password = String(data.password || '');
  if (!username || !password) return fail('请输入账号和密码', 40001);

  const res = await db.collection('admins').where({ username }).limit(1).get();
  const admin = res.data[0];
  if (!admin || admin.status !== 'enabled' || !verifyPassword(admin, password)) {
    return fail('账号或密码错误，请重新输入', 40003);
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

module.exports = { login, requireAdmin };

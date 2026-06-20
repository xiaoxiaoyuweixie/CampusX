function ok(data = null, message = 'success') {
  return { code: 0, message, data };
}

function fail(message = 'error', code = 50000, data = null) {
  return { code, message, data };
}

function now() {
  return new Date().toISOString();
}

function getUid(context, event) {
  return event.userId || context.OPENID || context.openid || '';
}

function parsePagination(event = {}) {
  const page = Math.max(Number(event.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(event.pageSize || 10), 1), 50);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

module.exports = { ok, fail, now, getUid, parsePagination };

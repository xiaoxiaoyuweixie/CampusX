const { login, requireAdmin } = require('./lib/auth');
const { httpResponse, parseHttpEvent } = require('./lib/http');
const { fail, ok } = require('./lib/response');
const { listCategories, updateCategory } = require('./services/categories');
const { listChatMessages, listChatSessions } = require('./services/chats');
const { getDashboard } = require('./services/dashboard');
const { listProducts, updateProductStatus } = require('./services/products');
const { listUsers, getUserDetail, updateUserStatus } = require('./services/users');
const { listReports, getReportDetail, getReportEvidence, processReport } = require('./services/reports');

const protectedActions = {
  getDashboard,
  listUsers,
  getUserDetail,
  updateUserStatus,
  listProducts,
  updateProductStatus,
  listCategories,
  updateCategory,
  listChatSessions,
  listChatMessages,
  listReports,
  getReportDetail,
  getReportEvidence,
  processReport,
};

async function handleAction(event = {}) {
  const { action, data = {} } = event;

  // 当前版本不开放初始化管理员功能。
  // if (action === 'initAdmins') return initAdmins();
  if (action === 'login') return login(data);

  const admin = await requireAdmin(data);
  if (!admin) return fail('登录已失效，请重新登录', 40004);

  const handler = protectedActions[action];
  if (handler) return handler(data, admin);

  return fail('请求的操作暂不支持', 40001, { action });
}

exports.main = async (event = {}) => {
  const httpEvent = parseHttpEvent(event);
  const isHttp = !!httpEvent;

  try {
    if (httpEvent && httpEvent.preflight) return httpResponse(ok(true));
    if (httpEvent && httpEvent.parseError) return httpResponse(fail('请求数据格式错误，请刷新后重试', 40001), 400);

    const result = await handleAction(isHttp ? httpEvent : event);
    return isHttp ? httpResponse(result) : result;
  } catch (err) {
    const result = fail('后台服务异常，请稍后重试', 50000, {
      message: err.message || '',
      name: err.name || '',
      stack: err.stack || '',
    });
    return isHttp ? httpResponse(result, 500) : result;
  }
};

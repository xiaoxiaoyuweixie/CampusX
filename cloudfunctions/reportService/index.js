const { cloud, BusinessError } = require('./lib/core');
const { getContext, getSubmissionResult, submit } = require('./services/reports');
const { prepareEvidence } = require('./services/evidence');
const actions = { getContext, getSubmissionResult, prepareEvidence, submit };

exports.main = async (event = {}) => {
  try {
    const openid = cloud.getWXContext().OPENID;
    if (!openid) throw new BusinessError('请先登录', 40004);
    const handler = Object.prototype.hasOwnProperty.call(actions, event.action) && actions[event.action];
    if (!handler) throw new BusinessError('暂不支持此操作', 400);
    return { code: 0, message: 'success', data: await handler(event.data || {}, openid) };
  } catch (err) {
    return { code: err instanceof BusinessError ? err.code : 500,
      message: err instanceof BusinessError ? err.message : '举报提交失败，请重试', data: err instanceof BusinessError ? err.data : null };
  }
};

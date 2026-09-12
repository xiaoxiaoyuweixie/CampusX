const { cloud, db } = require('../lib/cloud');
const { ok, fail } = require('../lib/response');
const statuses = ['pending', 'substantiated', 'unsubstantiated'];

class ReportError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}
function reject(message, code = 400) { throw new ReportError(message, code); }
async function document(store, collection, id) {
  if (!id) return null;
  try { return (await store.collection(collection).doc(id).get()).data || null; }
  catch (err) {
    if (/DOCUMENT_NOT_FOUND|DATABASE_DOCUMENT_NOT_EXIST|document.*(not exist|not found)/i.test(`${err.code} ${err.message}`)) return null;
    throw err;
  }
}
function reportId(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) reject('请选择要查看的举报');
  return value;
}
async function report(data) {
  const record = await document(db, 'reports', reportId(data.reportId));
  if (!record) reject('举报不存在或已被删除', 404);
  return record;
}
function summary(record) {
  return { reportId: record._id, reporter: record.reporter, reported: record.reported, product: record.product,
    sessionId: record.sessionId, reasonCode: record.reasonCode, createdAt: record.createdAt, status: record.status };
}
function action(handler, errorMessage) {
  return async (data = {}, admin) => {
    try { return ok(await handler(data, admin)); }
    catch (err) { return fail(err instanceof ReportError ? err.message : errorMessage, err instanceof ReportError ? err.code : 500); }
  };
}
const listReports = action(async data => {
  const status = data.status === undefined ? 'pending' : data.status;
  if (status !== 'all' && !statuses.includes(status)) reject('请选择有效的举报状态');
  const requestedPage = Number(data.page || 1);
  if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) reject('分页参数无效');
  const query = status === 'all' ? {} : { status }, pageSize = 20;
  const total = (await db.collection('reports').where(query).count()).total;
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize)));
  const result = await db.collection('reports').where(query).orderBy('createdAt', 'desc').orderBy('_id', 'desc')
    .skip((page - 1) * pageSize).limit(pageSize).get();
  return { page, pageSize, total, list: result.data.map(summary) };
}, '举报列表加载失败，请重试');

const getReportDetail = action(async data => {
  const record = await report(data);
  const [reporter, reported, product, session] = await Promise.all([
    document(db, 'users', record.reporterDocId), document(db, 'users', record.reportedDocId),
    document(db, 'products', record.productDocId), document(db, 'chat_sessions', record.sessionDocId),
  ]);
  return { ...summary(record), session: record.session, detail: record.detail,
    attachments: (record.attachments || []).map(({ imageId, width, height, size }) => ({ imageId, width, height, size })),
    processing: record.processing || null,
    related: { reporterExists: !!reporter, reportedExists: !!reported, productExists: !!product, sessionExists: !!session,
      reporterId: record.reporterDocId, reportedId: record.reportedDocId, productId: record.productDocId } };
}, '举报详情加载失败，请重试');

const getReportEvidence = action(async data => {
  const record = await report(data);
  const attachment = (record.attachments || []).find(item => item.imageId === data.imageId);
  if (!attachment) reject('截图不存在', 404);
  const result = await cloud.getTempFileURL({ fileList: [{ fileID: attachment.fileId, maxAge: 600 }] });
  const file = (result.fileList || [])[0];
  if (!file || !file.tempFileURL || (file.status && file.status !== 0)) reject('截图加载失败，点击重试', 500);
  return { url: file.tempFileURL };
}, '截图加载失败，点击重试');

const processReport = action(async (data, admin) => {
  const id = reportId(data.reportId);
  if (!['substantiated', 'unsubstantiated'].includes(data.result)) reject('请选择处理结果');
  if (typeof data.remark !== 'string' || !data.remark.trim()) reject('请输入处理备注');
  if (Array.from(data.remark).length > 200) reject('处理备注最多输入200字');
  return db.runTransaction(async transaction => {
    const currentAdmin = admin && await document(transaction, 'admins', admin._id);
    if (!currentAdmin || currentAdmin.status !== 'enabled' || currentAdmin.role !== 'super_admin') reject('登录已失效，请重新登录', 40004);
    const record = await document(transaction, 'reports', id);
    if (!record) reject('举报不存在或已被删除', 404);
    if (record.status !== 'pending') reject('该举报已处理，请刷新查看', 409);
    const processing = { result: data.result, remark: data.remark, adminId: currentAdmin._id,
      adminName: currentAdmin.nickname || currentAdmin.username || '', processedAt: new Date().toISOString() };
    await transaction.collection('reports').doc(id).update({ data: { status: data.result, processing } });
    const guard = await document(transaction, 'report_pending_guards', record.guardId);
    if (guard && guard.reportId === id) await transaction.collection('report_pending_guards').doc(record.guardId).update({ data: {
      reportId: '', updatedAt: processing.processedAt,
    } });
    return { reportId: id, status: data.result, processing };
  });
}, '处理失败，请重试');

module.exports = { listReports, getReportDetail, getReportEvidence, processReport };

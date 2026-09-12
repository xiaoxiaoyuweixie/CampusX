const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { fixture } = require('./helpers/cloud');
const { api } = require('../miniprogram/api');
const reportState = require('../miniprogram/utils/report-state');

// Exercise the actual client adapters and service dispatchers together. Only the
// transport and CloudBase infrastructure are replaced; no business API is mocked.
async function connected(t) {
  const f = fixture();
  const report = f.load('cloudfunctions/reportService/index.js');
  const admin = f.load('cloudfunctions/adminService/index.js');
  const originalWx = global.wx, originalFetch = global.fetch;
  let dropResponse = false;
  global.wx = { cloud: {
    uploadFile: ({ cloudPath, filePath }) => f.cloud.uploadFile({ cloudPath, fileContent: filePath }),
    callFunction: async ({ name, data }) => {
      assert.equal(name, 'reportService');
      const result = await report.main(data);
      if (dropResponse && data.action === 'submit') { dropResponse = false; throw new Error('response lost after commit'); }
      return { result };
    },
  } };
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://admin.test.invalid/');
    assert.equal(options.method, 'POST');
    const result = await admin.main({ httpMethod: 'POST', body: options.body });
    return { ok: result.statusCode >= 200 && result.statusCode < 300, status: result.statusCode,
      text: async () => result.body };
  };
  t.after(() => { global.wx = originalWx; global.fetch = originalFetch; });
  const source = fs.readFileSync(path.resolve(__dirname, '../admin-web/src/api/cloud.js'), 'utf8')
    .replace('import.meta.env.VITE_ADMIN_API_URL', JSON.stringify('https://admin.test.invalid/'));
  const { callAdmin } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const password = crypto.randomBytes(16).toString('hex'), salt = crypto.randomBytes(12).toString('hex');
  f.tables().admins = { reviewer: { _id: 'reviewer', username: 'reviewer', nickname: '测试审核员',
    role: 'super_admin', status: 'enabled', salt,
    passwordHash: crypto.createHash('sha256').update(`${salt}:${password}`).digest('hex') } };
  const login = await callAdmin('login', { username: 'reviewer', password });
  assert.equal(login.code, 0);
  return { ...f, dropNextSubmitResponse: () => { dropResponse = true; },
    admin: (action, data = {}) => callAdmin(action, { ...data, token: login.data.token }) };
}

test('real mini and admin contracts preserve evidence, recover a lost response and close an empty-session report', async t => {
  const f = await connected(t);
  f.tables().products.product.status = 'sold';
  f.tables().users.seller.status = 'disabled';
  const context = await api.getReportContext({ sessionId: 'S1' });
  assert.equal(context.result.code, 0);
  assert.equal(context.result.data.peer.openid, 'seller');
  const detail = '  核查这次沟通\n🙂  ';
  const attempt = reportState.createAttempt({ revision: 'draft-1', reasonCode: 'suspected_fraud', detail,
    images: [{ imageId: 'image_contract_1', extension: 'png' }] });
  const prepared = await api.prepareReportEvidence({ sessionId: 'S1', submissionId: attempt.submissionId,
    imageId: attempt.images[0].imageId, extension: 'png' });
  assert.equal(prepared.result.code, 0);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');
  const uploaded = await wx.cloud.uploadFile({ cloudPath: prepared.result.data.cloudPath, filePath: png });
  attempt.images[0].fileId = uploaded.fileID;
  const body = reportState.requestBody('S1', attempt);
  f.dropNextSubmitResponse();
  await assert.rejects(api.submitReport(body), /response lost/);
  const receipt = await api.getReportSubmissionResult({ submissionId: attempt.submissionId });
  assert.equal(receipt.result.code, 0);
  assert.equal(receipt.result.data.submitted, true);
  assert.deepEqual(Object.keys(receipt.result.data).sort(), ['reportId', 'submissionId', 'submitted']);
  const reportId = receipt.result.data.reportId;
  const list = await f.admin('listReports');
  assert.equal(list.code, 0);
  assert.equal(list.data.total, 1);
  assert.equal(list.data.list[0].reportId, reportId);
  const report = await f.admin('getReportDetail', { reportId });
  assert.equal(report.code, 0);
  assert.equal(report.data.detail, detail);
  assert.equal(report.data.attachments[0].imageId, attempt.images[0].imageId);
  assert.equal(Object.hasOwn(report.data.attachments[0], 'fileId'), false);
  const formal = f.tables().reports[reportId].attachments[0].fileId;
  assert.notEqual(formal, uploaded.fileID);
  assert.deepEqual(f.state.files.get(formal), png);
  f.state.files.delete(uploaded.fileID);
  delete f.tables().products.product;
  delete f.tables().users.seller;
  delete f.tables().chat_sessions.session;
  assert.equal((await api.getReportContext({ sessionId: 'S1' })).result.code, 404);
  assert.deepEqual((await api.submitReport(body)).result.data, receipt.result.data);
  assert.equal((await f.admin('getReportEvidence', { reportId, imageId: attempt.images[0].imageId })).code, 0);
  const remark = ' 已核查原始证据\n予以结案 ';
  const processed = await f.admin('processReport', { reportId, result: 'substantiated', remark, adminId: 'forged' });
  assert.equal(processed.code, 0);
  assert.equal(processed.data.processing.adminId, 'reviewer');
  assert.equal(processed.data.processing.remark, remark);
  assert.equal((await f.admin('listReports')).data.total, 0);
  assert.deepEqual((await api.getReportSubmissionResult({ submissionId: attempt.submissionId })).result.data, receipt.result.data);
  assert.equal(Object.keys(f.tables().reports).length, 1);
  assert.deepEqual(f.tables().chat_messages, {});
});

test('report pending guard is shared across real adapter attempts and released only by admin conclusion', async t => {
  const f = await connected(t);
  const form = { revision: 'draft-1', reasonCode: 'other', detail: '请求核查', images: [] };
  const first = reportState.requestBody('S1', reportState.createAttempt(form));
  const second = reportState.requestBody('S1', reportState.createAttempt(form));
  const results = await Promise.all([api.submitReport(first), api.submitReport(second)]);
  assert.deepEqual(results.map(value => value.result.code).sort(), [0, 409]);
  const reportId = results.find(value => value.result.code === 0).result.data.reportId;
  assert.equal((await f.admin('processReport', { reportId, result: 'unsubstantiated', remark: '未发现违规' })).code, 0);
  const next = await api.submitReport(reportState.requestBody('S1', reportState.createAttempt(form)));
  assert.equal(next.result.code, 0);
  assert.notEqual(next.result.data.reportId, reportId);
  assert.equal((await f.admin('listReports')).data.total, 1);
  assert.equal((await f.admin('listReports', { status: 'all' })).data.total, 2);
  assert.equal(f.tables().products.product.status, 'on_sale');
  assert.equal(f.tables().users.seller.status, 'enabled');
});

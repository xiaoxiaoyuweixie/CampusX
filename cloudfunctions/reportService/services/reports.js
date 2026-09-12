const { db, BusinessError, reject, hash, identifier, doc, userContext, context, freshContext, sessionKey, reportId,
  guardId, receipt, userSnapshot } = require('../lib/core');
const { readEvidence, copyEvidence } = require('./evidence');
const reasons = ['political_sensitive', 'sexual_content', 'illegal_content', 'abusive_language', 'advertising', 'suspected_fraud', 'other'];

function material(data) {
  if (typeof data.sessionId !== 'string' || !data.sessionId || data.sessionId.length > 128) reject('无权举报该会话', 403);
  if (!reasons.includes(data.reasonCode)) reject('请选择举报原因');
  if (typeof data.detail !== 'string' || !data.detail.trim()) reject('请输入详细信息');
  if (Array.from(data.detail).length > 100) reject('详细信息最多输入100字');
  const attachments = data.attachments === undefined ? [] : data.attachments;
  if (!Array.isArray(attachments)) reject('图片信息无效，请重新选择');
  if (attachments.length > 9) reject('最多上传9张截图');
  const seen = new Set();
  for (const attachment of attachments) {
    if (!attachment || typeof attachment.fileId !== 'string' || attachment.fileId.length > 1024) reject('图片信息无效，请重新选择');
    identifier(attachment.imageId, '图片标识');
    if (seen.has(attachment.imageId)) reject('图片信息无效，请重新选择');
    seen.add(attachment.imageId);
  }
  return { sessionId: data.sessionId, reasonCode: data.reasonCode, detail: data.detail,
    attachments: attachments.map(({ imageId, fileId }) => ({ imageId, fileId })) };
}
function assertFingerprint(existing, fingerprint, openid) {
  if (existing && existing.reporterOpenid !== openid) reject('无权读取该提交', 403);
  if (existing && existing.fingerprint !== fingerprint) reject('举报内容已变化，请重新确认后提交', 409);
}
function assertOpen(attempt) {
  if (attempt && attempt.rejection) reject(attempt.rejection.message, attempt.rejection.code);
}
async function getContext(data, openid) {
  const ctx = await context(data.sessionId, openid);
  return { sessionId: sessionKey(ctx.session), product: { productId: ctx.product.productId || ctx.product._id, title: ctx.product.title || '' },
    peer: { openid: ctx.peer.openid, nickname: ctx.peer.nickname || '校园用户' } };
}
async function getSubmissionResult(data, openid) {
  await userContext(openid);
  const record = await doc(db, 'reports', reportId(openid, data.submissionId));
  if (!record) return { submitted: false };
  if (record.reporterOpenid !== openid) reject('无权读取该提交', 403);
  return receipt(record);
}
async function submit(data, openid) {
  const user = await userContext(openid);
  const id = reportId(openid, data.submissionId);
  const body = material(data), fingerprint = hash(JSON.stringify(body));
  try { return await performSubmit(data, openid, user, id, body, fingerprint); }
  catch (err) {
    if (!(err instanceof BusinessError) || err.code < 400 || err.code >= 500) throw err;
    // Fence every worker for this exact body before calling a rejection definitive.
    // Another retry may already have read the evidence and still be copying it.
    return db.runTransaction(async transaction => {
      const current = await doc(transaction, 'reports', id);
      assertFingerprint(current, fingerprint, openid);
      if (current) return receipt(current);
      const attempt = await doc(transaction, 'report_submissions', id);
      assertFingerprint(attempt, fingerprint, openid);
      if (!attempt) await transaction.collection('report_submissions').doc(id).set({ data: {
        reporterOpenid: openid, sessionId: body.sessionId, submissionId: data.submissionId, fingerprint,
        createdAt: new Date().toISOString(), rejection: { code: err.code, message: err.message },
      } });
      else if (!attempt.rejection) await transaction.collection('report_submissions').doc(id).update({ data: {
        rejection: { code: err.code, message: err.message },
      } });
      // Throw only after this transaction commits; throwing inside would roll back the fence.
      return { rejection: attempt && attempt.rejection || { code: err.code, message: err.message } };
    }).then(result => {
      if (result.rejection) reject(result.rejection.message, result.rejection.code, {
        settled: true, rejected: true, submissionId: data.submissionId,
      });
      return result;
    });
  }
}
async function performSubmit(data, openid, user, id, body, fingerprint) {
  const existing = await doc(db, 'reports', id);
  assertFingerprint(existing, fingerprint, openid);
  // A receipt is independent of the continued existence or accessibility of related objects.
  if (existing) return receipt(existing);
  const ctx = await context(body.sessionId, openid, user), key = sessionKey(ctx.session);
  await db.runTransaction(async transaction => {
    const attempt = await doc(transaction, 'report_submissions', id);
    assertFingerprint(attempt, fingerprint, openid);
    assertOpen(attempt);
    if (!attempt) await transaction.collection('report_submissions').doc(id).set({ data: {
      reporterOpenid: openid, sessionId: key, submissionId: data.submissionId, fingerprint, createdAt: new Date().toISOString(),
    } });
  });
  const files = await readEvidence(body.attachments, key, data.submissionId, openid);
  const evidenceFingerprint = hash(JSON.stringify(files.map(file => [file.imageId, file.digest])));
  await db.runTransaction(async transaction => {
    const attempt = await doc(transaction, 'report_submissions', id);
    assertFingerprint(attempt, fingerprint, openid);
    assertOpen(attempt);
    if (attempt.evidenceFingerprint && attempt.evidenceFingerprint !== evidenceFingerprint) reject('举报内容已变化，请重新确认后提交', 409);
    await transaction.collection('report_submissions').doc(id).update({ data: { evidenceFingerprint } });
  });
  // Storage writes stay outside transaction callbacks, which CloudBase may retry.
  const attachments = await copyEvidence(files, openid, data.submissionId);
  return db.runTransaction(async transaction => {
    const current = await doc(transaction, 'reports', id);
    assertFingerprint(current, fingerprint, openid);
    if (current) return receipt(current);
    const attempt = await doc(transaction, 'report_submissions', id);
    assertFingerprint(attempt, fingerprint, openid);
    assertOpen(attempt);
    const fresh = await freshContext(transaction, ctx, openid);
    const lockId = guardId(openid, key);
    const guard = await doc(transaction, 'report_pending_guards', lockId);
    if (guard && guard.reportId) reject('该会话已有待处理举报，请勿重复提交', 409);
    const createdAt = new Date().toISOString();
    const record = { reporterOpenid: openid, submissionId: data.submissionId, fingerprint, evidenceFingerprint,
      sessionId: key, sessionDocId: fresh.session._id, reporterDocId: fresh.user._id, reportedDocId: fresh.peer._id,
      productDocId: fresh.product._id, reporter: userSnapshot(fresh.user), reported: userSnapshot(fresh.peer),
      product: { productId: fresh.product.productId || fresh.product._id, title: fresh.product.title || '' },
      session: { sessionId: key, productId: fresh.session.productId, buyerOpenid: fresh.session.buyerOpenid, sellerOpenid: fresh.session.sellerOpenid },
      reasonCode: body.reasonCode, detail: body.detail, attachments, status: 'pending', processing: null, createdAt, guardId: lockId };
    await transaction.collection('reports').doc(id).set({ data: record });
    await transaction.collection('report_pending_guards').doc(lockId).set({ data: {
      reporterOpenid: openid, sessionId: key, reportId: id, updatedAt: createdAt,
    } });
    return receipt({ ...record, _id: id });
  });
}
module.exports = { getContext, getSubmissionResult, submit };

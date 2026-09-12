const { cloud, db, crypto, reject, hash, identifier, doc, context, sessionKey, reportId } = require('../lib/core');
const { MAX_IMAGE_BYTES, imageInfo } = require('../lib/image-format');
const sharp = require('sharp');
sharp.concurrency(1);
sharp.cache(false);
const uploadId = (openid, submissionId, imageId) => hash(JSON.stringify([openid, identifier(submissionId), identifier(imageId, '图片标识')]));

async function prepareEvidence(data, openid) {
  const ctx = await context(data.sessionId, openid);
  const key = sessionKey(ctx.session);
  const id = uploadId(openid, data.submissionId, data.imageId);
  const extension = data.extension === 'jpeg' ? 'jpg' : data.extension;
  if (!['jpg', 'png', 'webp'].includes(extension)) reject('暂不支持该图片格式');
  const cloudPath = `report-staging/${openid}/${crypto.randomBytes(24).toString('hex')}.${extension}`;
  return db.runTransaction(async transaction => {
    const existing = await doc(transaction, 'report_evidence_uploads', id);
    if (existing) {
      if (existing.sessionId !== key || existing.extension !== extension) reject('举报内容已变化，请重新确认后提交', 409);
      return { cloudPath: existing.cloudPath };
    }
    await transaction.collection('report_evidence_uploads').doc(id).set({ data: {
      reporterOpenid: openid, sessionId: key, submissionId: data.submissionId, imageId: data.imageId,
      extension, cloudPath, createdAt: new Date().toISOString(),
    } });
    return { cloudPath };
  });
}
async function readEvidence(attachments, sessionId, submissionId, openid) {
  const files = [];
  for (const attachment of attachments) {
    const prepared = await doc(db, 'report_evidence_uploads', uploadId(openid, submissionId, attachment.imageId));
    const parsed = /^cloud:\/\/([^/]+)\/(.+)$/.exec(attachment.fileId);
    const env = cloud.getWXContext().ENV;
    if (!prepared || prepared.reporterOpenid !== openid || prepared.sessionId !== sessionId
      || !parsed || !env || !parsed[1].startsWith(`${env}.`) || parsed[2] !== prepared.cloudPath) reject('图片信息无效，请重新选择', 403);
    let result;
    try { result = await cloud.downloadFile({ fileID: attachment.fileId }); }
    catch (err) { reject('截图上传失败，请重试', 400); }
    const bytes = result.fileContent;
    if (!Buffer.isBuffer(bytes) || !bytes.length) reject('暂不支持该图片格式');
    if (bytes.length > MAX_IMAGE_BYTES) reject('单张图片不能超过10MB');
    const metadata = imageInfo(bytes);
    if (!metadata || metadata.format !== prepared.extension) reject('暂不支持该图片格式');
    try {
      // Decode every image before accepting it; checking magic bytes alone accepts forged pixel streams.
      // The tiny output is discarded. The original bytes, never a transcoded derivative, become evidence.
      await sharp(bytes, { failOn: 'warning', limitInputPixels: false, sequentialRead: true })
        .resize(1, 1, { fit: 'fill' }).raw().toBuffer();
    } catch (err) { reject('暂不支持该图片格式'); }
    files.push({ imageId: attachment.imageId, bytes, digest: hash(bytes), size: bytes.length, ...metadata });
  }
  return files;
}
async function copyEvidence(files, openid, submissionId) {
  const attachments = [];
  for (const file of files) {
    const cloudPath = `report-evidence/${reportId(openid, submissionId)}/${crypto.randomBytes(24).toString('hex')}.${file.format}`;
    const result = await cloud.uploadFile({ cloudPath, fileContent: file.bytes });
    if (!result.fileID) throw new Error('Evidence copy failed');
    attachments.push({ imageId: file.imageId, fileId: result.fileID, width: file.width, height: file.height,
      format: file.format, size: file.size, digest: file.digest });
  }
  return attachments;
}
module.exports = { prepareEvidence, readEvidence, copyEvidence };

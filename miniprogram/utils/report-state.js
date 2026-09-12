const storage = require('./storage');

const reasons = [
  { code: 'political_sensitive', label: '涉及政治敏感' },
  { code: 'sexual_content', label: '色情或性暗示' },
  { code: 'illegal_content', label: '违反国家法律法规' },
  { code: 'abusive_language', label: '语言低俗，恶意攻击他人' },
  { code: 'advertising', label: '广告内容' },
  { code: 'suspected_fraud', label: '疑似诈骗（假买家/假客服/假支付截图）' },
  { code: 'other', label: '其他' },
];
let sequence = 0;
function newId() { return `r${Date.now().toString(36)}_${(++sequence).toString(36)}_${Math.random().toString(36).slice(2, 12)}`; }
function key(owner, sessionId) { return `report:v1:${encodeURIComponent(owner)}:${encodeURIComponent(sessionId)}`; }
function read(owner, sessionId) {
  const saved = storage.get(key(owner, sessionId), {}) || {};
  return { stamp: saved.stamp || '', revision: saved.revision || '', reasonCode: saved.reasonCode || '',
    detail: typeof saved.detail === 'string' ? saved.detail : '', images: Array.isArray(saved.images) ? saved.images : [],
    attempt: saved.attempt || null };
}
// All writes compare the version read by this page. A late page cannot replace a newer draft.
function write(owner, sessionId, state) {
  if (!owner || !sessionId || read(owner, sessionId).stamp !== state.stamp) return false;
  const next = { ...state, stamp: newId() };
  try { wx.setStorageSync(key(owner, sessionId), next); state.stamp = next.stamp; return true; }
  catch (err) { return false; }
}
function formError(form) {
  if (!reasons.some(item => item.code === form.reasonCode)) return '请选择举报原因';
  if (!form.detail.trim()) return '请输入详细信息';
  if (Array.from(form.detail).length > 100) return '详细信息最多输入100字';
  if (form.images.length > 9) return '最多上传9张截图';
  if (form.images.some(item => item.missing || !item.localPath)) return '部分截图已失效，请重新选择';
  return '';
}
function createAttempt(state) {
  return { submissionId: newId(), draftRevision: state.revision, phase: 'preparing',
    reasonCode: state.reasonCode, detail: state.detail, images: state.images.map(item => ({ ...item, fileId: '' })) };
}
function requestBody(sessionId, attempt) {
  return { sessionId, submissionId: attempt.submissionId, reasonCode: attempt.reasonCode,
    detail: attempt.detail, attachments: attempt.images.map(item => ({ imageId: item.imageId, fileId: item.fileId })) };
}
function clearSuccess(owner, sessionId, attempt) {
  const current = read(owner, sessionId);
  if (!current.attempt || current.attempt.submissionId !== attempt.submissionId || current.revision !== attempt.draftRevision) return null;
  const paths = current.images.map(item => item.localPath).filter(Boolean);
  const empty = { stamp: current.stamp, revision: newId(), reasonCode: '', detail: '', images: [], attempt: null };
  return write(owner, sessionId, empty) ? { state: empty, paths } : null;
}
module.exports = { reasons, newId, key, read, write, formError, createAttempt, requestBody, clearSuccess };

import { escapeHtml } from './format.js';

export const reportReasons = {
  political_sensitive: '涉及政治敏感',
  sexual_content: '色情或性暗示',
  illegal_content: '违反国家法律法规',
  abusive_language: '语言低俗，恶意攻击他人',
  advertising: '广告内容',
  suspected_fraud: '疑似诈骗（假买家/假客服/假支付截图）',
  other: '其他',
};

export const reportStatuses = {
  pending: '待处理',
  substantiated: '举报成立',
  unsubstantiated: '举报不成立',
};

export function reportPerson(person = {}) {
  return `${escapeHtml(person.nickname || '未命名用户')}${person.account ? `<small class="report-secondary">账号：${escapeHtml(person.account)}</small>` : ''}`;
}

export function reportStatus(status) {
  return `<span class="tag${status === 'substantiated' ? ' danger' : ''}">${escapeHtml(reportStatuses[status] || '未知状态')}</span>`;
}

export function reportAuthError(error) {
  return error.code === 40004 || String(error.message).includes('unauthorized');
}

export function safeReportImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch (err) { return ''; }
}

export async function reportCall(context, action, data, timeoutMs = 20000) {
  let timeout;
  try {
    return await Promise.race([
      context.adminCall(action, data),
      new Promise((resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('请求超时')), timeoutMs);
      }),
    ]);
  } finally { clearTimeout(timeout); }
}

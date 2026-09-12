import { escapeHtml, formatDate, statusText } from '../utils/format.js';
import { reportAuthError, reportCall, safeReportImageUrl } from '../utils/report-format.js';
import { renderUserDetail } from './user-detail.js';

function renderProduct(product) {
  return `<h3>当前商品</h3><dl class="user-detail-fields">
    <div class="user-detail-field"><dt>标题</dt><dd>${escapeHtml(product.title || '未命名商品')}</dd></div>
    <div class="user-detail-field"><dt>商品编号</dt><dd>${escapeHtml(product.productId || product._id)}</dd></div>
    <div class="user-detail-field"><dt>价格</dt><dd>¥${escapeHtml(product.price ?? '-')}</dd></div>
    <div class="user-detail-field"><dt>状态</dt><dd>${escapeHtml(statusText(product.status))}</dd></div>
    <div class="user-detail-field user-detail-field--wide"><dt>描述</dt><dd>${escapeHtml(product.description || '未填写')}</dd></div>
  </dl>`;
}

function renderMessages(data, page) {
  const pages = Math.max(1, Math.ceil((Number(data.total) || 0) / 20));
  return `<h3>当前关联聊天</h3><p class="report-muted">以下为当前仍存在的聊天记录，不是提交时的完整聊天快照。</p>
    ${(data.list || []).map(message => {
      const url = safeReportImageUrl(message.imageUrl);
      return `<div class="message-item">
        <strong>${escapeHtml(message.senderRole === 'buyer' ? '买家' : message.senderRole === 'seller' ? '卖家' : '会话参与者')}</strong>
        ${message.type === 'image' ? url
          ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer"><img class="report-chat-image" src="${escapeHtml(url)}" alt="聊天图片" referrerpolicy="no-referrer" /></a>`
          : '<p>聊天图片暂时无法加载，请刷新</p>' : `<p class="report-text">${escapeHtml(message.content || '')}</p>`}
        <span>${escapeHtml(formatDate(message.createdTimestamp || message.createdAt))}</span>
      </div>`;
    }).join('') || '<p class="report-muted">暂无消息</p>'}
    <div class="report-pagination"><span>第 ${page} / ${pages} 页</span>
      <button data-report-chat-page="${page - 1}"${page <= 1 ? ' disabled' : ''}>较新消息</button>
      <button data-report-chat-page="${page + 1}"${page >= pages ? ' disabled' : ''}>较早消息</button>
      <button data-report-chat-page="${page}">刷新消息</button>
    </div>`;
}

export function bindReportRelated(context, report, current) {
  let sequence = 0;
  async function loadRelated(type, page = 1) {
    if (!current()) return;
    const request = ++sequence;
    const panel = document.querySelector('[data-report-related-panel]');
    if (!panel) return;
    panel.hidden = false;
    panel.innerHTML = '<p class="report-muted" role="status">关联记录加载中...</p>';
    const valid = () => current() && sequence === request && panel.isConnected !== false;
    try {
      let content;
      if (type === 'reporter' || type === 'reported') {
        const user = await reportCall(context, 'getUserDetail', { id: report.related?.[`${type}Id`] });
        content = renderUserDetail(user);
      } else if (type === 'product') {
        const data = await reportCall(context, 'listProducts', { id: report.related?.productId, page: 1, pageSize: 1 });
        content = data.list?.[0] ? renderProduct(data.list[0]) : '<p class="report-muted">关联记录已不存在</p>';
      } else if (type === 'session') {
        const data = await reportCall(context, 'listChatMessages', { sessionId: report.sessionId, page, pageSize: 20 });
        content = renderMessages(data, page);
      }
      if (!valid()) return;
      panel.innerHTML = content || '';
      panel.querySelectorAll('[data-report-chat-page]').forEach(button => button.addEventListener('click', () => {
        if (valid() && !button.disabled) loadRelated('session', Number(button.dataset.reportChatPage));
      }));
    } catch (error) {
      if (!valid()) return;
      if (reportAuthError(error)) { context.onError(error); return; }
      panel.innerHTML = error.code === 404 || error.code === 40400
        ? '<p class="report-muted">关联记录已不存在</p>'
        : '<div class="error-box" role="alert"><p>关联记录加载失败，请重试</p><button data-report-related-retry>重试</button></div>';
      panel.querySelector('[data-report-related-retry]')?.addEventListener('click', () => {
        if (valid()) loadRelated(type, page);
      });
    }
  }
  document.querySelectorAll('[data-report-related]').forEach(button => button.addEventListener('click', () => loadRelated(button.dataset.reportRelated)));
}

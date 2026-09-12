import { escapeHtml, formatDate, statusText } from '../utils/format.js';

function displayValue(value) {
  return value === '' || value == null ? '<span class="user-value-empty">未填写</span>' : escapeHtml(value);
}

function field(label, content, wide = false) {
  return `<div class="user-detail-field${wide ? ' user-detail-field--wide' : ''}"><dt>${label}</dt><dd>${content}</dd></div>`;
}

function contactValue(contact = {}) {
  const enabled = contact.enabled === true;
  return `<span class="user-contact-value">${displayValue(contact.value)}</span><span class="user-contact-visibility${enabled ? ' user-contact-visibility--enabled' : ''}">${enabled ? '已对外开放' : '未对外开放'}</span>`;
}

export function renderUserDetail(user) {
  return `
    <section class="user-detail" aria-label="用户资料">
      <h2>基本信息</h2>
      <dl class="user-detail-fields">
        ${field('昵称', displayValue(user.nickname))}
        ${field('账号', displayValue(user.account))}
        ${field('性别', displayValue(user.gender))}
        ${field('状态', `<span class="tag ${user.status === 'disabled' ? 'danger' : ''}">${escapeHtml(statusText(user.status || 'enabled'))}</span>`)}
        ${field('个性签名', displayValue(user.bio), true)}
        ${field('更新时间', escapeHtml(formatDate(user.updatedAt)), true)}
      </dl>
      <h2>联系方式</h2>
      <dl class="user-detail-fields">
        ${field('微信号', contactValue(user.contacts?.wechat))}
        ${field('电话号码', contactValue(user.contacts?.phone))}
      </dl>
    </section>
  `;
}

function renderDetailPage(context, content) {
  const rendered = context.renderApp(`
    <div class="user-detail-toolbar"><button class="user-back-button" data-user-back>返回用户列表</button></div>
    ${content}
  `);
  if (rendered === false) return;
  document.querySelector('[data-user-back]').addEventListener('click', context.onBackToUsers);
  document.querySelector('[data-user-detail-retry]')?.addEventListener('click', context.onRetry);
}

export async function loadUserDetail(context) {
  renderDetailPage(context, '<p class="user-detail-state" role="status">用户信息加载中...</p>');
  try {
    const user = await context.adminCall('getUserDetail', { id: context.userId });
    if (!user) throw new Error('用户信息加载失败，请稍后重试');
    renderDetailPage(context, renderUserDetail(user));
  } catch (err) {
    if (err.code === 40004 || String(err.message).includes('unauthorized')) throw err;
    renderDetailPage(context, `<div class="error-box" role="alert">
      <p>${escapeHtml(err.code ? err.message : '用户信息加载失败，请稍后重试')}</p>
      <button data-user-detail-retry>重试</button>
    </div>`);
  }
}

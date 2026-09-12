import { getAdmin } from '../state/session.js';
import { escapeHtml } from '../utils/format.js';

export function renderLayout({ app, navItems, view, title = '', content = '', onNavigate, onRefresh, onLogout }) {
  const admin = getAdmin();
  app.innerHTML = `
    <div class="layout">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <div class="brand-mark small">CX</div>
          <div>
            <strong>CampusX</strong>
            <span>管理后台</span>
          </div>
        </div>
        <nav>
          ${navItems.map(item => `
            <button class="${view === item.key ? 'active' : ''}" data-nav="${item.key}">
              ${item.label}
            </button>
          `).join('')}
        </nav>
      </aside>
      <main class="main">
        <header class="topbar">
          <div>
            <h1>${escapeHtml(title || navItems.find(item => item.key === view)?.label || '')}</h1>
            <p>云环境：cloud1-d6g5stkeb92288dee</p>
          </div>
          <div class="topbar-actions">
            <span>${escapeHtml(admin.nickname || admin.username || '')}</span>
            <button data-refresh>刷新</button>
            <button data-logout>退出</button>
          </div>
        </header>
        <div class="loading" data-loading hidden>加载中...</div>
        <section data-content>${content}</section>
      </main>
    </div>
  `;

  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => onNavigate(btn.dataset.nav));
  });
  document.querySelector('[data-refresh]').addEventListener('click', onRefresh);
  document.querySelector('[data-logout]').addEventListener('click', onLogout);
}

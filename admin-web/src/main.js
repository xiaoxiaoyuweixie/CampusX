import './styles.css';
import { callAdmin } from './cloud.js';
import { clearSession, getAdmin, getToken, setSession } from './state.js';

const app = document.querySelector('#app');

const navItems = [
  { key: 'dashboard', label: '数据看板' },
  { key: 'users', label: '用户列表' },
  { key: 'products', label: '商品列表' },
  { key: 'categories', label: '分类列表' },
  { key: 'chats', label: '聊天记录' },
];

const state = {
  view: 'dashboard',
  loading: false,
  data: {},
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(value) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN', { hour12: false });
}

function statusText(status) {
  const map = {
    enabled: '启用',
    disabled: '禁用',
    on_sale: '在售',
    off_shelf: '已下架',
    sold: '已售出',
    active: '正常',
  };
  return map[status] || status || '-';
}

async function adminCall(action, data = {}) {
  const payload = await callAdmin(action, { ...data, token: getToken() });
  if (payload.code !== 0) {
    throw new Error(payload.message || '请求失败');
  }
  return payload.data;
}

function setLoading(loading) {
  state.loading = loading;
  const el = document.querySelector('[data-loading]');
  if (el) el.hidden = !loading;
}

function renderLogin() {
  app.innerHTML = `
    <main class="login-shell">
      <section class="login-card">
        <div class="brand-mark">CX</div>
        <h1>CampusX 后台管理</h1>
        <p>使用超级管理员账号登录。</p>
        <form data-login-form>
          <label>
            <span>账号</span>
            <input name="username" autocomplete="username" placeholder="wu / xiao" required />
          </label>
          <label>
            <span>密码</span>
            <input name="password" type="password" autocomplete="current-password" placeholder="请输入密码" required />
          </label>
          <button type="submit">登录</button>
        </form>
        <button class="text-btn" type="button" data-init-admins>初始化管理员</button>
        <p class="hint" data-login-message></p>
      </section>
    </main>
  `;

  document.querySelector('[data-login-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = document.querySelector('[data-login-message]');
    message.textContent = '登录中...';
    try {
      const payload = await callAdmin('login', {
        username: form.get('username'),
        password: form.get('password'),
      });
      if (payload.code !== 0) throw new Error(payload.message || '登录失败');
      setSession(payload.data.token, payload.data.admin);
      state.view = 'dashboard';
      renderApp();
      await loadCurrentView();
    } catch (err) {
      message.textContent = err.message || '登录失败';
    }
  });

  document.querySelector('[data-init-admins]').addEventListener('click', async () => {
    const message = document.querySelector('[data-login-message]');
    message.textContent = '初始化中...';
    try {
      const payload = await callAdmin('initAdmins');
      message.textContent = payload.code === 0 ? '管理员已初始化' : payload.message;
    } catch (err) {
      message.textContent = err.message || '初始化失败';
    }
  });
}

function layout(content = '') {
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
            <button class="${state.view === item.key ? 'active' : ''}" data-nav="${item.key}">
              ${item.label}
            </button>
          `).join('')}
        </nav>
      </aside>
      <main class="main">
        <header class="topbar">
          <div>
            <h1>${navItems.find(item => item.key === state.view)?.label || ''}</h1>
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
    btn.addEventListener('click', async () => {
      state.view = btn.dataset.nav;
      renderApp();
      await loadCurrentView();
    });
  });
  document.querySelector('[data-refresh]').addEventListener('click', loadCurrentView);
  document.querySelector('[data-logout]').addEventListener('click', () => {
    clearSession();
    renderLogin();
  });
}

function renderApp(content = '') {
  layout(content);
}

function renderDashboard(data) {
  const cards = [
    ['用户总数', data.userCount],
    ['禁用用户', data.disabledUserCount],
    ['商品总数', data.productCount],
    ['在售商品', data.onSaleCount],
    ['已下架', data.offShelfCount],
    ['已售出', data.soldCount],
    ['分类数', data.categoryCount],
    ['会话数', data.sessionCount],
    ['消息数', data.messageCount],
  ];
  renderApp(`
    <div class="metric-grid">
      ${cards.map(([label, value]) => `
        <article class="metric-card">
          <span>${label}</span>
          <strong>${value ?? 0}</strong>
        </article>
      `).join('')}
    </div>
  `);
}

function renderTable({ columns, rows, empty = '暂无数据' }) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>${columns.map(col => `<th>${col.label}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.length ? rows.map(row => `
            <tr>
              ${columns.map(col => `<td>${col.render(row)}</td>`).join('')}
            </tr>
          `).join('') : `<tr><td colspan="${columns.length}" class="empty">${empty}</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

async function loadDashboard() {
  const data = await adminCall('getDashboard');
  renderDashboard(data);
}

async function loadUsers() {
  const data = await adminCall('listUsers', { page: 1, pageSize: 50 });
  renderApp(renderTable({
    rows: data.list || [],
    columns: [
      { label: '昵称', render: row => escapeHtml(row.nickname || '-') },
      { label: '账号', render: row => escapeHtml(row.account || '-') },
      { label: '性别', render: row => escapeHtml(row.gender || '-') },
      { label: '状态', render: row => `<span class="tag ${row.status === 'disabled' ? 'danger' : ''}">${statusText(row.status || 'enabled')}</span>` },
      { label: '更新时间', render: row => formatDate(row.updatedAt || row.createdAt) },
      {
        label: '操作',
        render: row => `<button data-user-status="${row._id}" data-status="${row.status === 'disabled' ? 'enabled' : 'disabled'}">${row.status === 'disabled' ? '启用' : '禁用'}</button>`,
      },
    ],
  }));
  bindUserActions();
}

function bindUserActions() {
  document.querySelectorAll('[data-user-status]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await adminCall('updateUserStatus', { id: btn.dataset.userStatus, status: btn.dataset.status });
      await loadUsers();
    });
  });
}

async function loadProducts() {
  const data = await adminCall('listProducts', { page: 1, pageSize: 50 });
  renderApp(renderTable({
    rows: data.list || [],
    columns: [
      { label: '标题', render: row => escapeHtml(row.title || '-') },
      { label: '分类', render: row => escapeHtml(row.categoryName || row.categoryId || '-') },
      { label: '价格', render: row => `¥${row.price ?? '-'}` },
      { label: '卖家', render: row => escapeHtml(row.sellerName || row.openid || '-') },
      { label: '状态', render: row => `<span class="tag">${statusText(row.status)}</span>` },
      { label: '更新时间', render: row => formatDate(row.updatedAt || row.createdAt) },
      {
        label: '操作',
        render: row => `
          <button data-product-status="${row.productId || row._id}" data-status="off_shelf">下架</button>
          <button data-product-status="${row.productId || row._id}" data-status="on_sale">上架</button>
        `,
      },
    ],
  }));
  bindProductActions();
}

function bindProductActions() {
  document.querySelectorAll('[data-product-status]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await adminCall('updateProductStatus', { id: btn.dataset.productStatus, status: btn.dataset.status });
      await loadProducts();
    });
  });
}

async function loadCategories() {
  const data = await adminCall('listCategories', { page: 1, pageSize: 50 });
  renderApp(`
    ${renderTable({
      rows: data.list || [],
      columns: [
        { label: 'ID', render: row => escapeHtml(row.categoryId || row.id || '-') },
        { label: '名称', render: row => `<input class="inline-input" value="${escapeHtml(row.name || '')}" data-cat-name="${row._id}" />` },
        { label: '描述', render: row => `<input class="inline-input wide" value="${escapeHtml(row.description || '')}" data-cat-description="${row._id}" />` },
        { label: '排序', render: row => `<input class="inline-input small-input" type="number" value="${row.sort || 0}" data-cat-sort="${row._id}" />` },
        { label: '状态', render: row => `<select data-cat-status="${row._id}"><option value="enabled" ${row.status !== 'disabled' ? 'selected' : ''}>启用</option><option value="disabled" ${row.status === 'disabled' ? 'selected' : ''}>禁用</option></select>` },
        { label: '操作', render: row => `<button data-save-category="${row._id}">保存</button>` },
      ],
    })}
  `);
  bindCategoryActions();
}

function bindCategoryActions() {
  document.querySelectorAll('[data-save-category]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.saveCategory;
      await adminCall('updateCategory', {
        id,
        name: document.querySelector(`[data-cat-name="${id}"]`).value,
        description: document.querySelector(`[data-cat-description="${id}"]`).value,
        sort: document.querySelector(`[data-cat-sort="${id}"]`).value,
        status: document.querySelector(`[data-cat-status="${id}"]`).value,
      });
      await loadCategories();
    });
  });
}

async function loadChats() {
  const data = await adminCall('listChatSessions', { page: 1, pageSize: 50 });
  renderApp(`
    <div class="split">
      <div>
        ${renderTable({
          rows: data.list || [],
          columns: [
            { label: '商品', render: row => escapeHtml(row.productTitle || '-') },
            { label: '买家', render: row => escapeHtml((row.buyerSnapshot && row.buyerSnapshot.nickname) || row.buyerOpenid || '-') },
            { label: '卖家', render: row => escapeHtml((row.sellerSnapshot && row.sellerSnapshot.nickname) || row.sellerOpenid || '-') },
            { label: '最后消息', render: row => escapeHtml((row.lastMessage && row.lastMessage.content) || '-') },
            { label: '更新时间', render: row => formatDate(row.updatedAt || row.createdAt) },
            { label: '操作', render: row => `<button data-chat-session="${row.sessionId || row._id}">查看消息</button>` },
          ],
        })}
      </div>
      <aside class="message-panel" data-message-panel>选择会话查看消息</aside>
    </div>
  `);
  bindChatActions();
}

function bindChatActions() {
  document.querySelectorAll('[data-chat-session]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const data = await adminCall('listChatMessages', { sessionId: btn.dataset.chatSession, page: 1, pageSize: 100 });
      const panel = document.querySelector('[data-message-panel]');
      panel.innerHTML = `
        <h2>消息记录</h2>
        ${(data.list || []).map(message => `
          <div class="message-item">
            <strong>${escapeHtml(message.senderRole || message.senderOpenid || '-')}</strong>
            <p>${escapeHtml(message.content || '')}</p>
            <span>${formatDate(message.createdTimestamp || message.createdAt)}</span>
          </div>
        `).join('') || '<p class="empty">暂无消息</p>'}
      `;
    });
  });
}

async function loadCurrentView() {
  if (!getToken()) {
    renderLogin();
    return;
  }
  setLoading(true);
  try {
    if (state.view === 'dashboard') await loadDashboard();
    if (state.view === 'users') await loadUsers();
    if (state.view === 'products') await loadProducts();
    if (state.view === 'categories') await loadCategories();
    if (state.view === 'chats') await loadChats();
  } catch (err) {
    if (String(err.message).includes('unauthorized')) {
      clearSession();
      renderLogin();
      return;
    }
    renderApp(`<div class="error-box">${escapeHtml(err.message || '加载失败')}</div>`);
  } finally {
    setLoading(false);
  }
}

if (getToken()) {
  renderApp();
  loadCurrentView();
} else {
  renderLogin();
}

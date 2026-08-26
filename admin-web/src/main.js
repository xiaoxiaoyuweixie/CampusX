import './styles.css';
import { callAdmin } from './api/cloud.js';
import { renderLayout } from './layout/app-layout.js';
import { clearSession, getToken, setSession } from './state/session.js';
import { escapeHtml } from './utils/format.js';
import { loadCategories } from './views/categories.js';
import { loadChats } from './views/chats.js';
import { loadDashboard } from './views/dashboard.js';
import { renderLogin as renderLoginView } from './views/login.js';
import { loadProducts } from './views/products.js';
import { loadUsers } from './views/users.js';

const app = document.querySelector('#app');

const navItems = [
  { key: 'dashboard', label: '数据看板' },
  { key: 'users', label: '用户列表' },
  { key: 'products', label: '商品列表' },
  { key: 'categories', label: '分类列表' },
  { key: 'chats', label: '聊天记录' },
];

const viewLoaders = {
  dashboard: loadDashboard,
  users: loadUsers,
  products: loadProducts,
  categories: loadCategories,
  chats: loadChats,
};

const state = {
  view: 'dashboard',
  loading: false,
};

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
  renderLoginView({
    app,
    callAdmin,
    setSession,
    onSuccess: async () => {
      state.view = 'dashboard';
      renderApp();
      await loadCurrentView();
    },
  });
}

function renderApp(content = '') {
  renderLayout({
    app,
    navItems,
    view: state.view,
    content,
    onNavigate: async view => {
      state.view = view;
      renderApp();
      await loadCurrentView();
    },
    onRefresh: loadCurrentView,
    onLogout: () => {
      clearSession();
      renderLogin();
    },
  });
}

async function loadCurrentView() {
  if (!getToken()) {
    renderLogin();
    return;
  }

  setLoading(true);
  try {
    const loadView = viewLoaders[state.view];
    if (loadView) await loadView({ adminCall, renderApp });
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

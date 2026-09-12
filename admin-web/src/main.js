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
import { loadUserDetail } from './views/user-detail.js';
import { loadReports } from './views/reports.js';
import { loadReportDetail } from './views/report-detail.js';

const app = document.querySelector('#app');

const navItems = [
  { key: 'dashboard', label: '数据看板' },
  { key: 'users', label: '用户列表' },
  { key: 'products', label: '商品列表' },
  { key: 'categories', label: '分类列表' },
  { key: 'chats', label: '聊天记录' },
  { key: 'reports', label: '举报管理' },
];

const viewLoaders = {
  dashboard: loadDashboard,
  users: loadUsers,
  products: loadProducts,
  categories: loadCategories,
  chats: loadChats,
  reports: loadReports,
};

const state = {
  view: 'dashboard',
  userId: '',
  reportId: '',
  reportList: { status: 'pending', page: 1 },
  loading: false,
};
let viewRevision = 0;

async function adminCall(action, data = {}) {
  const payload = await callAdmin(action, { ...data, token: getToken() });
  if (!payload || payload.code !== 0) {
    const error = new Error(payload?.message || '请求失败');
    error.code = payload?.code;
    throw error;
  }
  return payload.data;
}

function setLoading(loading) {
  state.loading = loading;
  const el = document.querySelector('[data-loading]');
  if (el) el.hidden = !loading;
}

function renderLogin() {
  viewRevision += 1;
  renderLoginView({
    app,
    callAdmin,
    setSession,
    onSuccess: async () => {
      state.view = 'dashboard';
      state.userId = '';
      state.reportId = '';
      state.reportList = { status: 'pending', page: 1 };
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
    title: state.view === 'users' && state.userId ? '用户详情' : state.view === 'reports' && state.reportId ? '举报详情' : '',
    content,
    onNavigate: view => navigate(view),
    onRefresh: loadCurrentView,
    onLogout: () => {
      clearSession();
      renderLogin();
    },
  });
}

async function navigate(view, userId = '') {
  if (view === 'reports' && state.view !== 'reports') state.reportList = { status: 'pending', page: 1 };
  state.view = view;
  state.userId = userId;
  state.reportId = '';
  renderApp();
  await loadCurrentView();
}

async function navigateReport(reportId = '') {
  state.view = 'reports';
  state.reportId = reportId;
  renderApp();
  await loadCurrentView();
}

async function loadCurrentView() {
  if (!getToken()) {
    renderLogin();
    return;
  }

  const revision = ++viewRevision;
  const token = getToken();
  const isCurrent = () => revision === viewRevision && getToken() === token;
  const renderCurrent = content => {
    if (!isCurrent()) return false;
    renderApp(content);
    return true;
  };
  const onError = err => {
    if (!isCurrent()) return;
    if (err.code === 40004 || String(err.message).includes('unauthorized')) {
      clearSession();
      renderLogin();
      return;
    }
    renderCurrent(`<div class="error-box">${escapeHtml(err.message || '加载失败')}</div>`);
  };
  setLoading(true);
  try {
    const loadView = state.view === 'users' && state.userId ? loadUserDetail
      : state.view === 'reports' && state.reportId ? loadReportDetail : viewLoaders[state.view];
    if (loadView) await loadView({
      adminCall, renderApp: renderCurrent, userId: state.userId,
      isCurrent, onError, reportId: state.reportId, reportList: state.reportList,
      onViewReport: id => navigateReport(id),
      onBackToReports: () => navigateReport(),
      onReportListChange: changes => {
        if (!isCurrent()) return;
        Object.assign(state.reportList, changes);
        return loadCurrentView();
      },
      onViewUser: id => navigate('users', id),
      onBackToUsers: () => navigate('users'),
      onRetry: loadCurrentView,
    });
  } catch (err) {
    onError(err);
  } finally {
    if (isCurrent()) setLoading(false);
  }
}

if (getToken()) {
  renderApp();
  loadCurrentView();
} else {
  renderLogin();
}

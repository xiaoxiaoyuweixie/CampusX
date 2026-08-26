import { renderTable } from '../components/table.js';
import { escapeHtml, formatDate, statusText } from '../utils/format.js';

export async function loadUsers({ adminCall, renderApp }) {
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
  bindUserActions({ adminCall, renderApp });
}

function bindUserActions(context) {
  document.querySelectorAll('[data-user-status]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await context.adminCall('updateUserStatus', { id: btn.dataset.userStatus, status: btn.dataset.status });
      await loadUsers(context);
    });
  });
}

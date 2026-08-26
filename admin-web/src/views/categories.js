import { renderTable } from '../components/table.js';
import { escapeHtml } from '../utils/format.js';

export async function loadCategories({ adminCall, renderApp }) {
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
  bindCategoryActions({ adminCall, renderApp });
}

function bindCategoryActions(context) {
  document.querySelectorAll('[data-save-category]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.saveCategory;
      await context.adminCall('updateCategory', {
        id,
        name: document.querySelector(`[data-cat-name="${id}"]`).value,
        description: document.querySelector(`[data-cat-description="${id}"]`).value,
        sort: document.querySelector(`[data-cat-sort="${id}"]`).value,
        status: document.querySelector(`[data-cat-status="${id}"]`).value,
      });
      await loadCategories(context);
    });
  });
}

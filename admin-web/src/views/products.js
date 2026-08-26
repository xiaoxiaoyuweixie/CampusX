import { renderTable } from '../components/table.js';
import { escapeHtml, formatDate, statusText } from '../utils/format.js';

export async function loadProducts({ adminCall, renderApp }) {
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
  bindProductActions({ adminCall, renderApp });
}

function bindProductActions(context) {
  document.querySelectorAll('[data-product-status]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await context.adminCall('updateProductStatus', { id: btn.dataset.productStatus, status: btn.dataset.status });
      await loadProducts(context);
    });
  });
}

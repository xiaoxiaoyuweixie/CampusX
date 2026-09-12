import { renderTable } from '../components/table.js';
import { escapeHtml, formatDate } from '../utils/format.js';
import { reportAuthError, reportCall, reportPerson, reportReasons, reportStatus, reportStatuses } from '../utils/report-format.js';

const PAGE_SIZE = 20;

export function renderReportList(data, filter = 'pending') {
  const page = Math.max(1, Number(data.page) || 1);
  const total = Math.max(0, Number(data.total) || 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return `
    <div class="report-list-toolbar">
      <label>处理状态 <select data-report-filter aria-label="举报处理状态">
        ${Object.entries({ all: '全部', ...reportStatuses }).map(([key, label]) => `<option value="${key}"${filter === key ? ' selected' : ''}>${label}</option>`).join('')}
      </select></label>
      <span class="report-muted">共 ${total} 条举报</span>
    </div>
    ${renderTable({
      empty: '暂无举报记录',
      rows: data.list || [],
      columns: [
        { label: '举报编号', render: row => `<span class="report-id">${escapeHtml(row.reportId)}</span>` },
        { label: '举报人', render: row => reportPerson(row.reporter) },
        { label: '被举报人', render: row => reportPerson(row.reported) },
        { label: '关联商品', render: row => escapeHtml(row.product?.title || '未命名商品') },
        { label: '举报原因', render: row => `<span class="report-reason">${escapeHtml(reportReasons[row.reasonCode] || '未知原因')}</span>` },
        { label: '提交时间', render: row => escapeHtml(formatDate(row.createdAt)) },
        { label: '状态', render: row => reportStatus(row.status) },
        { label: '操作', render: row => `<button data-report-view="${escapeHtml(row.reportId)}">查看</button>` },
      ],
    })}
    <div class="report-pagination">
      <span>第 ${page} / ${pages} 页，每页 ${PAGE_SIZE} 条</span>
      <button data-report-page="${page - 1}"${page <= 1 ? ' disabled' : ''}>上一页</button>
      <button data-report-page="${page + 1}"${page >= pages ? ' disabled' : ''}>下一页</button>
    </div>`;
}

export async function loadReports(context) {
  const current = () => !context.isCurrent || context.isCurrent();
  const query = context.reportList || { status: 'pending', page: 1 };
  const status = query.status === 'all' || reportStatuses[query.status] ? query.status : 'pending';
  let page = Math.max(1, Number(query.page) || 1);
  try {
    let data;
    // Processing a report can remove the last row on a later filtered page.
    while (current()) {
      data = await reportCall(context, 'listReports', { status, page, pageSize: PAGE_SIZE });
      if (!current()) return;
      const lastPage = Math.max(1, Math.ceil((Number(data.total) || 0) / PAGE_SIZE));
      if (page <= lastPage) break;
      page = lastPage;
    }
    if (!current()) return;
    query.status = status;
    query.page = page;
    const rendered = context.renderApp(renderReportList({ ...data, page }, status));
    if (rendered === false) return;
    document.querySelector('[data-report-filter]').addEventListener('change', event => {
      if (current()) context.onReportListChange({ status: event.target.value, page: 1 });
    });
    document.querySelectorAll('[data-report-page]').forEach(button => button.addEventListener('click', () => {
      if (current() && !button.disabled) context.onReportListChange({ page: Number(button.dataset.reportPage) });
    }));
    document.querySelectorAll('[data-report-view]').forEach(button => button.addEventListener('click', () => {
      if (current()) context.onViewReport(button.dataset.reportView);
    }));
  } catch (error) {
    if (!current()) return;
    if (reportAuthError(error)) throw error;
    if (context.renderApp('<div class="error-box" role="alert"><p>举报列表加载失败，请重试</p><button data-report-list-retry>重试</button></div>') === false) return;
    document.querySelector('[data-report-list-retry]').addEventListener('click', context.onRetry);
  }
}

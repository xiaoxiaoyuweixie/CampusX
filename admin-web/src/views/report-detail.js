import { escapeHtml, formatDate } from '../utils/format.js';
import { reportAuthError, reportCall, reportPerson, reportReasons, reportStatus, reportStatuses, safeReportImageUrl } from '../utils/report-format.js';
import { bindReportRelated } from './report-related.js';

function field(label, value, wide = false) {
  return `<div class="user-detail-field${wide ? ' user-detail-field--wide' : ''}"><dt>${label}</dt><dd>${value}</dd></div>`;
}

function relatedLink(report, key, label) {
  return report.related?.[`${key}Exists`]
    ? `<button class="report-link" data-report-related="${key}">${label}</button>`
    : '<span class="report-secondary">关联记录已不存在</span>';
}

function sessionRole(report, person) {
  const openid = report[person]?.openid;
  if (openid && report.session?.buyerOpenid === openid) return ' · 买家';
  if (openid && report.session?.sellerOpenid === openid) return ' · 卖家';
  return '';
}

export function validateReportProcessing(result, remark) {
  if (!['substantiated', 'unsubstantiated'].includes(result)) return '请选择处理结果';
  if (typeof remark !== 'string' || !remark.trim()) return '请输入处理备注';
  if (Array.from(remark).length > 200) return '处理备注最多输入200字';
  return '';
}

export function renderReportDetail(report, state = {}) {
  const processing = report.processing;
  const attachments = report.attachments || [];
  const busy = state.busy || state.uncertain;
  return `
    <section class="report-section" aria-label="举报提交材料">
      <div class="report-heading"><h2>举报提交材料</h2>${reportStatus(report.status)}</div>
      <dl class="user-detail-fields">
        ${field('举报编号', escapeHtml(report.reportId))}
        ${field('提交时间', escapeHtml(formatDate(report.createdAt)))}
        ${field(`举报人（提交时${sessionRole(report, 'reporter')}）`, reportPerson(report.reporter) + relatedLink(report, 'reporter', '查看当前用户'))}
        ${field(`被举报人（提交时${sessionRole(report, 'reported')}）`, reportPerson(report.reported) + relatedLink(report, 'reported', '查看当前用户'))}
        ${field('关联商品（提交时）', escapeHtml(report.product?.title || '未命名商品') + `<small class="report-secondary">商品编号：${escapeHtml(report.product?.productId || '-')}</small>` + relatedLink(report, 'product', '查看当前商品'))}
        ${field('关联会话', `<span class="report-id">${escapeHtml(report.sessionId)}</span>` + relatedLink(report, 'session', '查看当前聊天'))}
        ${field('举报原因', escapeHtml(reportReasons[report.reasonCode] || '未知原因'), true)}
        ${field('详细信息', `<div class="report-text">${escapeHtml(report.detail || '')}</div>`, true)}
      </dl>
      <h3>举报截图 <span class="report-muted">${attachments.length} 张</span></h3>
      ${attachments.length ? `<div class="report-evidence-grid">${attachments.map((attachment, index) => `<div class="report-evidence" data-report-evidence="${index}"><p>截图 ${index + 1} 加载中...</p></div>`).join('')}</div>` : '<p class="report-muted">未上传截图</p>'}
      <div class="report-related-panel" data-report-related-panel hidden></div>
    </section>
    <section class="report-section" aria-label="举报处理">
      <h2>${report.status === 'pending' ? '处理举报' : '处理记录'}</h2>
      ${report.status === 'pending' ? `
        <p class="report-muted">处理结论只用于举报结案；账号和商品操作可通过既有管理入口另行执行。</p>
        <form data-report-process novalidate>
          <fieldset class="report-results"${busy ? ' disabled' : ''}>
            <legend>处理结果 <span aria-hidden="true">*</span></legend>
            ${['substantiated', 'unsubstantiated'].map(result => `<label><input type="radio" name="report-result" value="${result}"${state.result === result ? ' checked' : ''} />${reportStatuses[result]}</label>`).join('')}
          </fieldset>
          <label class="report-remark-label" for="report-remark">处理备注 <span aria-hidden="true">*</span></label>
          <textarea id="report-remark" name="report-remark" data-report-remark rows="4" aria-describedby="report-remark-count"${busy ? ' disabled' : ''}>${escapeHtml(state.remark || '')}</textarea>
          <p id="report-remark-count" class="report-muted report-counter" data-report-remark-count>${Array.from(state.remark || '').length}/200 字</p>
          <button type="submit" data-report-process-submit${busy ? ' disabled' : ''}>${state.busy ? '处理中...' : '提交处理'}</button>
        </form>` : `
        <dl class="user-detail-fields">
          ${field('处理结论', escapeHtml(reportStatuses[processing?.result || report.status] || '未知结论'))}
          ${field('处理时间', escapeHtml(formatDate(processing?.processedAt)))}
          ${field('处理人', escapeHtml(processing?.adminName || '未命名管理员'))}
          ${field('处理人编号', escapeHtml(processing?.adminId || '-'))}
          ${field('处理备注', `<div class="report-text">${escapeHtml(processing?.remark || '')}</div>`, true)}
        </dl>`}
      <p class="report-feedback${state.error ? ' report-feedback--error' : ''}" role="status" data-report-feedback>${escapeHtml(state.notice || '')}</p>
      ${state.uncertain ? '<button data-report-process-refresh>刷新核实</button>' : ''}
    </section>`;
}

export async function loadReportDetail(context) {
  const current = () => !context.isCurrent || context.isCurrent();
  const state = { report: null, result: '', remark: '', busy: false, uncertain: false, notice: '', error: false, version: 0, refresh: 0 };
  const evidenceRequests = new Map();
  function shell(content) {
    if (!current()) return false;
    if (context.renderApp(`<div class="user-detail-toolbar"><button class="user-back-button" data-report-back>返回举报列表</button></div>${content}`) === false) return false;
    document.querySelector('[data-report-back]').addEventListener('click', () => { if (current()) context.onBackToReports(); });
    return true;
  }
  shell('<p class="user-detail-state" role="status">举报信息加载中...</p>');

  async function loadEvidence(attachment, index, version) {
    if (!current() || state.version !== version) return;
    const slot = document.querySelector(`[data-report-evidence="${index}"]`);
    if (!slot) return;
    const request = (evidenceRequests.get(index) || 0) + 1;
    evidenceRequests.set(index, request);
    const valid = () => current() && state.version === version && evidenceRequests.get(index) === request && slot.isConnected !== false;
    slot.innerHTML = `<p role="status">截图 ${index + 1} 加载中...</p>`;
    function showFailure() {
      if (!valid()) return;
      slot.innerHTML = `<button class="report-evidence-retry" data-report-evidence-retry>截图 ${index + 1}<br />截图加载失败，点击重试</button>`;
      slot.querySelector('[data-report-evidence-retry]').addEventListener('click', () => loadEvidence(attachment, index, version));
    }
    try {
      const data = await reportCall(context, 'getReportEvidence', { reportId: state.report.reportId, imageId: attachment.imageId });
      if (!valid()) return;
      const url = safeReportImageUrl(data.url);
      if (!url) { showFailure(); return; }
      slot.innerHTML = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" aria-label="预览举报截图 ${index + 1}"><img src="${escapeHtml(url)}" alt="举报截图 ${index + 1}" referrerpolicy="no-referrer" /></a>
        <div class="report-evidence-caption"><span>截图 ${index + 1}</span><button class="report-link" data-report-evidence-reload>重新加载</button></div>`;
      slot.querySelector('img').addEventListener('error', showFailure, { once: true });
      slot.querySelector('[data-report-evidence-reload]').addEventListener('click', () => loadEvidence(attachment, index, version));
    } catch (error) {
      if (!valid()) return;
      if (reportAuthError(error)) { context.onError(error); return; }
      showFailure();
    }
  }

  function feedback(text, error = true) {
    if (!current()) return;
    state.notice = text;
    state.error = error;
    const element = document.querySelector('[data-report-feedback]');
    if (element) {
      element.textContent = text;
      element.className = `report-feedback${error ? ' report-feedback--error' : ''}`;
    }
  }

  function render() {
    const version = ++state.version;
    if (!shell(renderReportDetail(state.report, state))) return;
    const valid = () => current() && state.version === version;
    bindReportRelated(context, state.report, valid);
    (state.report.attachments || []).forEach((attachment, index) => { loadEvidence(attachment, index, version); });
    document.querySelectorAll('[name="report-result"]').forEach(input => input.addEventListener('change', () => {
      if (valid()) state.result = input.value;
    }));
    document.querySelector('[data-report-remark]')?.addEventListener('input', event => {
      if (!valid()) return;
      state.remark = event.target.value;
      document.querySelector('[data-report-remark-count]').textContent = `${Array.from(state.remark).length}/200 字`;
    });
    document.querySelector('[data-report-process]')?.addEventListener('submit', event => {
      event.preventDefault();
      if (valid()) process();
    });
    document.querySelector('[data-report-process-refresh]')?.addEventListener('click', refreshResult);
  }

  async function refreshResult() {
    if (!current()) return;
    const request = ++state.refresh;
    try {
      const report = await reportCall(context, 'getReportDetail', { reportId: context.reportId });
      if (!current() || state.refresh !== request) return;
      state.report = report;
      state.uncertain = false;
      state.busy = false;
      state.notice = report.status === 'pending' ? '最新记录仍为待处理，可核实后重新提交' : '该举报已处理，以下为已保存的处理记录';
      state.error = false;
      render();
    } catch (error) {
      if (!current() || state.refresh !== request) return;
      if (reportAuthError(error)) { context.onError(error); return; }
      state.busy = false;
      state.uncertain = true;
      state.notice = '处理结果暂未确认，请刷新核实';
      state.error = true;
      render();
    }
  }

  async function process() {
    if (!current() || state.busy || state.uncertain || state.report.status !== 'pending') return;
    const validation = validateReportProcessing(state.result, state.remark);
    if (validation) { feedback(validation); return; }
    state.busy = true;
    state.notice = '';
    render();
    try {
      const result = await reportCall(context, 'processReport', { reportId: state.report.reportId, result: state.result, remark: state.remark });
      if (!current()) return;
      state.report = { ...state.report, ...result };
      state.busy = false;
      state.notice = '处理成功';
      state.error = false;
      render();
    } catch (error) {
      if (!current()) return;
      if (reportAuthError(error)) { context.onError(error); return; }
      if (error.code === 409 || !error.code || error.code >= 500 && error.code < 600 || error.code >= 50000) {
        state.uncertain = true;
        state.notice = error.code === 409 ? '该举报已处理，请刷新查看' : '处理结果暂未确认，请刷新核实';
        state.error = true;
        state.busy = false;
        render();
        await refreshResult();
        return;
      }
      state.busy = false;
      state.notice = error.code === 400 ? error.message : '处理失败，请重试';
      state.error = true;
      render();
    }
  }

  try {
    state.report = await reportCall(context, 'getReportDetail', { reportId: context.reportId });
    if (!current()) return;
    if (!state.report) throw new Error('举报信息加载失败，请重试');
    render();
  } catch (error) {
    if (!current()) return;
    if (reportAuthError(error)) throw error;
    const message = error.code === 404 ? '举报记录不存在' : '举报信息加载失败，请重试';
    if (!shell(`<div class="error-box" role="alert"><p>${message}</p><button data-report-detail-retry>重试</button></div>`)) return;
    document.querySelector('[data-report-detail-retry]').addEventListener('click', context.onRetry);
  }
}

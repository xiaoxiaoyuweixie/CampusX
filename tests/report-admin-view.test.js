const test = require('node:test');
const assert = require('node:assert/strict');

function domFixture(t) {
  class Element {
    constructor(html = '', attrs = {}) {
      this.attrs = attrs;
      this.dataset = Object.fromEntries(Object.entries(attrs).filter(([key]) => key.startsWith('data-')).map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase()), value]));
      this.value = attrs.value || '';
      this.disabled = Object.hasOwn(attrs, 'disabled');
      this.isConnected = true;
      this.events = new Map();
      this.cache = new Map();
      this.innerHTML = html;
    }
    set innerHTML(value) {
      for (const node of this.cache?.values() || []) node.disconnect();
      this.cache = new Map();
      this.html = value;
    }
    get innerHTML() { return this.html; }
    disconnect() { this.isConnected = false; for (const node of this.cache.values()) node.disconnect(); }
    addEventListener(name, handler) { this.events.set(name, handler); }
    querySelectorAll(selector) {
      const nodes = [];
      for (const match of this.html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
        const attrs = {};
        for (const attr of match[2].matchAll(/([^\s=]+)(?:="([^"]*)")?/g)) attrs[attr[1]] = attr[2] || '';
        const selectorAttr = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
        if (selectorAttr ? !Object.hasOwn(attrs, selectorAttr[1]) || selectorAttr[2] !== undefined && attrs[selectorAttr[1]] !== selectorAttr[2] : match[1] !== selector) continue;
        const key = match.index;
        if (!this.cache.has(key)) this.cache.set(key, new Element('', attrs));
        nodes.push(this.cache.get(key));
      }
      return nodes;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  }
  const previous = global.document;
  const root = new Element();
  global.document = root;
  const renders = [];
  let active = true;
  t.after(() => { if (previous === undefined) delete global.document; else global.document = previous; });
  return {
    root, renders,
    isCurrent: () => active,
    renderApp(html) { if (!active) return false; root.innerHTML = html; renders.push(html); return true; },
    leave() { active = false; root.innerHTML = 'other-view'; },
    get html() { return root.innerHTML; },
    node(selector) { return root.querySelector(selector); },
    async event(selector, name, props = {}) {
      const node = root.querySelector(selector);
      assert.ok(node, `${selector} exists`);
      assert.ok(node.events.has(name), `${selector} has ${name} handler`);
      await node.events.get(name)({ target: node, preventDefault() {}, ...props });
      await settle();
    },
  };
}

function settle() { return new Promise(resolve => setImmediate(resolve)); }
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function report(extra = {}) {
  return { reportId: 'r_001', reporter: { openid: 'secret-openid', nickname: '举报方', account: '10001' },
    reported: { nickname: '对方' }, product: { title: '课本', productId: 'p_001' }, sessionId: 's_001',
    reasonCode: 'suspected_fraud', detail: '第一行\n <script>alert(1)</script> ', status: 'pending', createdAt: '2026-09-12T01:00:00Z',
    attachments: [], processing: null, related: { reporterExists: false, reportedExists: false, productExists: false, sessionExists: false }, ...extra };
}
function context(f, adminCall, extra = {}) { return { renderApp: f.renderApp, isCurrent: f.isCurrent, adminCall, reportId: 'r_001', onBackToReports() {}, onError(error) { throw error; }, onRetry() {}, ...extra }; }

test('report list renders approved columns, statuses and escaped snapshots without openid display or search', async () => {
  const { renderReportList } = await import('../admin-web/src/views/reports.js');
  const html = renderReportList({ list: [report({ reporter: { nickname: '<img onerror=1>', account: '"100', openid: 'never-display' } })], page: 1, total: 1 });
  for (const label of ['举报编号', '举报人', '被举报人', '关联商品', '举报原因', '提交时间', '状态', '操作', '待处理', '举报成立', '举报不成立', '全部']) assert.ok(html.includes(label));
  assert.ok(html.includes('&lt;img onerror=1&gt;'));
  assert.ok(html.includes('账号：&quot;100'));
  assert.ok(html.includes('value="pending" selected'));
  assert.equal(html.includes('never-display'), false);
  assert.equal(html.includes('type="search"'), false);
  assert.equal(html.includes('第一行'), false, 'list does not expose full report text');
  assert.ok(renderReportList({ list: [], page: 1, total: 0 }).includes('暂无举报记录'));
});

test('list clamps an emptied page, retains query and resets pagination on filter change', async t => {
  const { loadReports } = await import('../admin-web/src/views/reports.js');
  const f = domFixture(t), calls = [], changes = [], viewed = [];
  const reportList = { status: 'pending', page: 3 };
  await loadReports(context(f, async (action, data) => {
    calls.push({ action, data });
    return { total: 21, list: data.page === 2 ? [report()] : [] };
  }, { reportList, onReportListChange: value => changes.push(value), onViewReport: id => viewed.push(id) }));
  assert.deepEqual(calls.map(call => call.data), [{ status: 'pending', page: 3, pageSize: 20 }, { status: 'pending', page: 2, pageSize: 20 }]);
  assert.equal(reportList.page, 2);
  await f.event('[data-report-filter]', 'change', { target: { value: 'all' } });
  await f.event('[data-report-view]', 'click');
  assert.deepEqual(changes, [{ status: 'all', page: 1 }]);
  assert.deepEqual(viewed, ['r_001']);
});

test('list distinguishes failure from empty and drops stale list responses', async t => {
  const { loadReports } = await import('../admin-web/src/views/reports.js');
  const f = domFixture(t);
  await loadReports(context(f, async () => { throw new TypeError('network'); }));
  assert.ok(f.html.includes('举报列表加载失败，请重试'));
  assert.equal(f.html.includes('暂无举报记录'), false);
  const pending = deferred();
  const load = loadReports(context(f, () => pending.promise));
  f.leave(); pending.resolve({ total: 1, list: [report()] }); await load;
  assert.equal(f.html, 'other-view');
});

test('detail safely preserves original text, missing reference notices and immutable processed record', async () => {
  const { renderReportDetail } = await import('../admin-web/src/views/report-detail.js');
  const html = renderReportDetail(report({ status: 'substantiated', processing: { result: 'substantiated', remark: ' 原文\n<img src=x> ', adminName: '<管理员>', adminId: 'a_1', processedAt: '2026-09-12T02:00:00Z' } }));
  assert.ok(html.includes('第一行\n &lt;script&gt;alert(1)&lt;/script&gt; '));
  assert.ok(html.includes(' 原文\n&lt;img src=x&gt; '));
  assert.ok(html.includes('&lt;管理员&gt;'));
  assert.equal((html.match(/关联记录已不存在/g) || []).length, 4);
  assert.ok(html.includes('未上传截图'));
  assert.equal(html.includes('data-report-process'), false);
  assert.equal(html.includes('secret-openid'), false);
});

test('processing validation uses Unicode code points and preserves valid raw text', async () => {
  const { validateReportProcessing } = await import('../admin-web/src/views/report-detail.js');
  assert.equal(validateReportProcessing('', '备注'), '请选择处理结果');
  assert.equal(validateReportProcessing('substantiated', ' \n\t'), '请输入处理备注');
  assert.equal(validateReportProcessing('substantiated', '😀'.repeat(200)), '');
  assert.equal(validateReportProcessing('unsubstantiated', '😀'.repeat(201)), '处理备注最多输入200字');
  assert.equal(validateReportProcessing('unsubstantiated', ' \n原文\n '), '');
});

test('submitted participant roles come from the immutable session relationship snapshot', async () => {
  const { renderReportDetail } = await import('../admin-web/src/views/report-detail.js');
  const html = renderReportDetail(report({ reported: { nickname: '卖家', openid: 'seller' }, session: { buyerOpenid: 'secret-openid', sellerOpenid: 'seller' } }));
  assert.ok(html.includes('举报人（提交时 · 买家）'));
  assert.ok(html.includes('被举报人（提交时 · 卖家）'));
  assert.equal(html.includes('secret-openid'), false);
});

test('a hanging report request times out without interpreting a late success as its response', async () => {
  const { reportCall } = await import('../admin-web/src/utils/report-format.js');
  const pending = deferred();
  await assert.rejects(reportCall({ adminCall: () => pending.promise }, 'processReport', {}, 1), { message: '请求超时' });
  pending.resolve({ status: 'substantiated' });
});

test('detail process sends only selected result and raw remark, prevents duplicate clicks and displays authoritative receipt', async t => {
  const { loadReportDetail } = await import('../admin-web/src/views/report-detail.js');
  const f = domFixture(t), submit = deferred(), calls = [];
  await loadReportDetail(context(f, async (action, data) => { calls.push({ action, data }); return action === 'getReportDetail' ? report() : submit.promise; }));
  await f.event('[name="report-result"]', 'change');
  await f.event('[data-report-remark]', 'input', { target: { value: '  核实\n属实😀  ' } });
  await f.event('[data-report-process]', 'submit');
  assert.ok(f.html.includes('处理中...'));
  await f.event('[data-report-process]', 'submit');
  assert.equal(calls.filter(call => call.action === 'processReport').length, 1);
  assert.deepEqual(calls[1].data, { reportId: 'r_001', result: 'substantiated', remark: '  核实\n属实😀  ' });
  submit.resolve({ reportId: 'r_001', status: 'substantiated', processing: { result: 'substantiated', remark: '  核实\n属实😀  ', adminName: '真实管理员', adminId: 'real-admin', processedAt: '2026-09-12T02:00:00Z' } });
  await settle();
  assert.ok(f.html.includes('处理成功'));
  assert.ok(f.html.includes('真实管理员'));
  assert.equal(f.html.includes('data-report-process-submit'), false);
});

test('lost process response refreshes authoritative terminal record without attempting overwrite', async t => {
  const { loadReportDetail } = await import('../admin-web/src/views/report-detail.js');
  const f = domFixture(t), calls = []; let read = 0;
  await loadReportDetail(context(f, async (action, data) => {
    calls.push({ action, data });
    if (action === 'processReport') throw new TypeError('Failed to fetch');
    return ++read === 1 ? report() : report({ status: 'unsubstantiated', processing: { result: 'unsubstantiated', remark: '另一管理员已经保存', adminName: '管理员乙' } });
  }));
  await f.event('[name="report-result"]', 'change');
  await f.event('[data-report-remark]', 'input', { target: { value: '本次备注' } });
  await f.event('[data-report-process]', 'submit');
  assert.equal(read, 2);
  assert.equal(calls.filter(call => call.action === 'processReport').length, 1);
  assert.ok(f.html.includes('另一管理员已经保存'));
  assert.ok(f.html.includes('管理员乙'));
  assert.equal(f.html.includes('data-report-process-submit'), false);
});

test('unknown result with unavailable refresh blocks repeat processing and preserves remark until refresh succeeds', async t => {
  const { loadReportDetail } = await import('../admin-web/src/views/report-detail.js');
  const f = domFixture(t); let read = 0, processes = 0;
  await loadReportDetail(context(f, async action => {
    if (action === 'processReport') { processes += 1; throw new TypeError('network'); }
    read += 1;
    if (read === 2) throw new TypeError('network');
    return report();
  }));
  await f.event('[name="report-result"]', 'change');
  await f.event('[data-report-remark]', 'input', { target: { value: ' 保留\n备注 ' } });
  await f.event('[data-report-process]', 'submit');
  assert.ok(f.html.includes('处理结果暂未确认，请刷新核实'));
  assert.ok(f.html.includes(' 保留\n备注 '));
  assert.equal(f.node('[data-report-process-submit]').disabled, true);
  await f.event('[data-report-process]', 'submit');
  assert.equal(processes, 1);
  await f.event('[data-report-process-refresh]', 'click');
  assert.equal(f.node('[data-report-process-submit]').disabled, false);
  assert.ok(f.html.includes(' 保留\n备注 '));
});

test('explicit process failure preserves input, and unauthorized detail propagates login error', async t => {
  const { loadReportDetail } = await import('../admin-web/src/views/report-detail.js');
  const f = domFixture(t);
  await loadReportDetail(context(f, async action => {
    if (action === 'getReportDetail') return report();
    throw Object.assign(new Error('处理备注最多输入200字'), { code: 400 });
  }));
  await f.event('[name="report-result"]', 'change');
  await f.event('[data-report-remark]', 'input', { target: { value: '原始备注' } });
  await f.event('[data-report-process]', 'submit');
  assert.ok(f.html.includes('原始备注'));
  assert.ok(f.html.includes('处理备注最多输入200字'));
  assert.equal(f.node('[data-report-process-submit]').disabled, false);
  await assert.rejects(loadReportDetail(context(f, async () => { throw Object.assign(new Error('登录失效'), { code: 40004 }); })), { code: 40004 });
});

test('evidence uses authenticated individual reads and can recover an expired URL without exposing file IDs', async t => {
  const { loadReportDetail } = await import('../admin-web/src/views/report-detail.js');
  const f = domFixture(t), calls = []; let imageReads = 0;
  await loadReportDetail(context(f, async (action, data) => {
    calls.push({ action, data });
    if (action === 'getReportDetail') return report({ attachments: [{ imageId: 'i_1', fileId: 'private-cloud-id' }] });
    imageReads += 1;
    return { url: imageReads === 1 ? 'javascript:alert(1)' : 'https://example.test/evidence?token=short-lived' };
  }));
  await settle();
  const slot = f.node('[data-report-evidence="0"]');
  assert.ok(slot.innerHTML.includes('截图加载失败，点击重试'));
  await slot.querySelector('[data-report-evidence-retry]').events.get('click')();
  await settle();
  assert.ok(slot.innerHTML.includes('https://example.test/evidence?token=short-lived'));
  assert.equal(slot.innerHTML.includes('private-cloud-id'), false);
  assert.deepEqual(calls[1], { action: 'getReportEvidence', data: { reportId: 'r_001', imageId: 'i_1' } });
  await slot.querySelector('img').events.get('error')();
  assert.ok(slot.innerHTML.includes('截图加载失败，点击重试'));
});

test('late detail and evidence responses never reinsert private data after navigation or logout', async t => {
  const { loadReportDetail } = await import('../admin-web/src/views/report-detail.js');
  const f = domFixture(t), image = deferred();
  await loadReportDetail(context(f, async action => action === 'getReportDetail' ? report({ attachments: [{ imageId: 'i_1' }] }) : image.promise));
  const slot = f.node('[data-report-evidence="0"]');
  f.leave();
  image.resolve({ url: 'https://example.test/private' });
  await settle();
  assert.equal(f.html, 'other-view');
  assert.equal(slot.innerHTML.includes('https://example.test/private'), false);
});

test('a late initial detail response cannot navigate back or repaint the current view', async t => {
  const { loadReportDetail } = await import('../admin-web/src/views/report-detail.js');
  const f = domFixture(t), pending = deferred();
  const loading = loadReportDetail(context(f, () => pending.promise));
  f.leave();
  pending.resolve(report());
  await loading;
  assert.equal(f.html, 'other-view');
  assert.equal(f.renders.length, 1);
});

test('related product lookup uses exact document ID and older responses cannot replace the latest selection', async t => {
  const { loadReportDetail } = await import('../admin-web/src/views/report-detail.js');
  const f = domFixture(t), user = deferred(), calls = [];
  await loadReportDetail(context(f, async (action, data) => {
    calls.push({ action, data });
    if (action === 'getReportDetail') return report({ related: { reporterExists: true, reporterId: 'user-doc', productExists: true, productId: 'product-doc' } });
    if (action === 'getUserDetail') return user.promise;
    return { list: [{ _id: 'product-doc', title: '当前商品标题', price: 12, description: '<script>商品</script>', status: 'off_shelf' }] };
  }));
  const pendingUser = f.node('[data-report-related="reporter"]').events.get('click')();
  await settle();
  await f.event('[data-report-related="product"]', 'click');
  const panel = f.node('[data-report-related-panel]');
  assert.ok(panel.innerHTML.includes('当前商品标题'));
  assert.ok(panel.innerHTML.includes('&lt;script&gt;商品&lt;/script&gt;'));
  assert.deepEqual(calls[2].data, { id: 'product-doc', page: 1, pageSize: 1 });
  user.resolve({ nickname: '旧请求私密用户资料' });
  await pendingUser;
  assert.equal(panel.innerHTML.includes('旧请求私密用户资料'), false);
});

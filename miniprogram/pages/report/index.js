const { api } = require('../../api/index');
const storage = require('../../utils/storage');
const reportState = require('../../utils/report-state');
const media = require('../../utils/report-media');

function payload(response, fallback) {
  const result = response && response.result;
  if (result && result.code === 0 && result.data) return result.data;
  const code = result && result.code;
  const definite = (code >= 400 && code < 500) || (code >= 40000 && code < 50000);
  const error = new Error(definite && result.message ? result.message : fallback);
  error.definite = definite;
  error.settlement = definite && result.data;
  throw error;
}
function isReceipt(result, attempt) {
  return result && result.submitted === true && result.reportId && result.submissionId === attempt.submissionId;
}

Page({
  data: {
    reasons: reportState.reasons, reasonCode: '', detail: '', count: 0, images: [],
    loading: true, contextReady: false, contextError: '', busy: false, picking: false,
    locked: false, unknown: false, succeeded: false,
  },
  onLoad(options) {
    const user = storage.get('userInfo', {}) || {};
    if (!user.logged || !user.openid) { wx.redirectTo({ url: '/pages/login/index' }); return; }
    this.owner = user.openid;
    this.sessionId = typeof options.sessionId === 'string' ? options.sessionId : '';
    this.epoch = 0;
    if (!this.sessionId) {
      this.setData({ loading: false, contextError: '缺少会话信息' });
      return;
    }
    this.state = reportState.read(this.owner, this.sessionId);
    this.render();
  },
  onShow() {
    if (!this.owner) return;
    if (!this.isCurrent()) {
      this.setData({ reasonCode: '', detail: '', count: 0, images: [], locked: true });
      wx.redirectTo({ url: '/pages/login/index' });
      return;
    }
    this.visible = true;
    if (this.pendingToast) { this.toast(this.pendingToast); this.pendingToast = ''; }
    if (!this.sessionId || this.data.picking) return;
    const epoch = ++this.epoch;
    this.state = reportState.read(this.owner, this.sessionId);
    this.render({ busy: false, succeeded: false });
    this.ready = this.initialize(epoch);
  },
  onHide() { this.visible = false; this.epoch += 1; this.stopReturn(); },
  onUnload() { this.onHide(); this.disposed = true; },
  stopReturn() { if (this.returnTimer) clearTimeout(this.returnTimer); this.returnTimer = null; },
  isCurrent() {
    const user = storage.get('userInfo', {}) || {};
    return !this.disposed && user.logged && this.owner === user.openid;
  },
  isActive(epoch) { return this.isCurrent() && this.visible && (epoch === undefined || epoch === this.epoch); },
  isAttached() {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    return this.isCurrent() && pages[pages.length - 1] === this;
  },
  toast(title) { if (this.isActive()) wx.showToast({ title, icon: 'none', duration: 3000 }); },
  pickerToast(title) {
    if (this.isActive()) this.toast(title);
    else if (this.isAttached()) this.pendingToast = title;
  },
  render(extra = {}) {
    if (!this.state || !this.isCurrent()) return;
    const unknown = !!(this.state.attempt && this.state.attempt.phase === 'unknown');
    this.setData({ reasonCode: this.state.reasonCode, detail: this.state.detail,
      count: Array.from(this.state.detail).length, images: this.state.images,
      unknown, locked: unknown || (extra.busy === undefined ? this.data.busy : extra.busy)
        || (extra.succeeded === undefined ? this.data.succeeded : extra.succeeded), ...extra });
  },
  save(allowNativeReturn = false) {
    if (!this.isActive() && !(allowNativeReturn && this.isAttached())) return false;
    if (reportState.write(this.owner, this.sessionId, this.state)) return true;
    this.toast('举报草稿保存失败，请重新进入后重试');
    return false;
  },
  async initialize(epoch) {
    this.setData({ loading: true, contextReady: false, contextError: '' });
    try {
      // Restore the original receipt before checking objects needed only for a NEW report.
      if (this.state.attempt && this.state.attempt.phase === 'unknown') {
        const attempt = this.state.attempt;
        const result = payload(await api.getReportSubmissionResult({ submissionId: attempt.submissionId }), '提交结果暂未确认，请重试');
        if (!this.isActive(epoch)) return;
        if (isReceipt(result, attempt)) { this.complete(attempt, epoch); return; }
        if (result.submitted !== false) throw new Error('提交结果暂未确认，请重试');
      }
      await this.restoreImages(epoch);
      if (this.isActive(epoch)) await this.loadContext(epoch);
    } catch (err) {
      if (this.isActive(epoch)) {
        this.setData({ contextError: err.message || '提交结果暂未确认，请重试' });
        this.toast(err.message || '提交结果暂未确认，请重试');
      }
    } finally { if (this.isActive(epoch)) this.setData({ loading: false }); }
  },
  async restoreImages(epoch) {
    const revision = this.state.revision;
    const images = await Promise.all(this.state.images.map(async item => ({ ...item, missing: !(await media.exists(item.localPath)) })));
    if (!this.isActive(epoch) || revision !== this.state.revision) return;
    if (JSON.stringify(images) !== JSON.stringify(this.state.images)) {
      this.state.images = images;
      this.save(); this.render();
    }
    if (images.some(item => item.missing)) this.toast('部分截图已失效，请重新选择');
  },
  async loadContext(epoch = this.epoch) {
    try {
      payload(await api.getReportContext({ sessionId: this.sessionId }), '举报信息加载失败，请重试');
      if (!this.isActive(epoch)) return false;
      this.setData({ contextReady: true, contextError: '' });
      return true;
    } catch (err) {
      if (this.isActive(epoch)) this.setData({ contextReady: false,
        contextError: err.definite ? err.message : '举报信息加载失败，请重试' });
      return false;
    }
  },
  onRetryLoad() {
    if (!this.isActive() || this.data.busy || this.data.picking) return;
    this.ready = this.initialize(++this.epoch);
    return this.ready;
  },
  editable() { return this.isActive() && !this.data.busy && !this.data.picking && !this.data.succeeded && !this.data.unknown; },
  edit(update) {
    if (!this.editable()) return false;
    Object.assign(this.state, update, { revision: reportState.newId(), attempt: null });
    const saved = this.save(); this.render();
    return saved;
  },
  onReason(e) { if (reportState.reasons.some(item => item.code === e.currentTarget.dataset.code)) this.edit({ reasonCode: e.currentTarget.dataset.code }); },
  onDetailInput(e) { this.edit({ detail: e.detail.value }); },
  async onChooseImages() {
    if (!this.editable()) return;
    const remaining = 9 - this.state.images.length;
    if (remaining <= 0) { this.toast('最多上传9张截图'); return; }
    const revision = this.state.revision;
    const previousImages = this.state.images;
    this.setData({ picking: true });
    const added = [];
    try {
      const selected = await media.selectImages(remaining);
      if ((!this.isActive() && !this.isAttached()) || this.state.revision !== revision) return;
      if (selected.tempFiles.length > remaining) { this.pickerToast('最多上传9张截图'); return; }
      for (const file of selected.tempFiles) {
        const image = await media.saveImage(file);
        added.push({ ...image, imageId: reportState.newId(), missing: false });
        if ((!this.isActive() && !this.isAttached()) || this.state.revision !== revision) return;
      }
      // A failed selection batch is retained as a failure, never silently omitting an invalid image.
      this.state.images = this.state.images.concat(added);
      this.state.revision = reportState.newId();
      this.state.attempt = null;
      if (this.save(true)) { added.length = 0; this.render(); }
      else { this.state.images = previousImages; this.render(); }
    } catch (err) {
      if (!media.cancelled(err)) this.pickerToast(['单张图片不能超过10MB', '暂不支持该图片格式'].includes(err.message)
        ? err.message : '无法使用相机或相册，请检查权限后重试');
    } finally {
      added.forEach(item => media.removeFile(item.localPath));
      if (this.isCurrent()) this.setData({ picking: false });
      if (this.isActive()) { this.ready = this.initialize(++this.epoch); await this.ready; }
    }
  },
  onRemoveImage(e) {
    if (!this.editable()) return;
    const image = this.state.images.find(item => item.imageId === e.currentTarget.dataset.id);
    if (!image) return;
    const saved = this.edit({ images: this.state.images.filter(item => item.imageId !== image.imageId) });
    if (saved && !this.state.images.some(item => item.localPath === image.localPath)) media.removeFile(image.localPath);
  },
  async onPreviewImage(e) {
    if (!this.isActive()) return;
    const image = this.state.images.find(item => item.imageId === e.currentTarget.dataset.id);
    if (!image || image.missing) { this.toast('部分截图已失效，请重新选择'); return; }
    try { await wx.previewImage({ current: image.localPath, urls: this.state.images.filter(item => !item.missing).map(item => item.localPath) }); }
    catch (err) { if (!media.cancelled(err)) this.toast('截图加载失败，请重新选择'); }
  },
  onImageError(e) {
    if (!this.isActive() || !this.state) return;
    const image = this.state.images.find(item => item.imageId === e.currentTarget.dataset.id);
    if (image && !image.missing) { image.missing = true; this.save(); this.render(); this.toast('部分截图已失效，请重新选择'); }
  },
  async onSubmit() {
    if (!this.isActive() || this.data.busy || this.data.picking || this.data.succeeded || !this.sessionId) return;
    const epoch = this.epoch;
    let attempt = this.state.attempt;
    const recovering = !!(attempt && attempt.phase === 'unknown');
    let dispatched = false;
    if (!recovering) {
      const error = reportState.formError(this.state);
      if (error) { this.toast(error); return; }
    }
    if (this.data.loading) return;
    this.setData({ busy: true, locked: true });
    try {
      if (recovering) {
        const result = payload(await api.getReportSubmissionResult({ submissionId: attempt.submissionId }), '提交结果暂未确认，请重试');
        if (!this.isActive(epoch)) return;
        if (isReceipt(result, attempt)) { this.complete(attempt, epoch); return; }
        if (result.submitted !== false) throw new Error('提交结果暂未确认，请重试');
      } else {
        if (!this.data.contextReady && !(await this.loadContext(epoch))) { this.toast(this.data.contextError); return; }
        if (!this.isActive(epoch)) return;
        // Recheck local bytes before upload, including restored files.
        for (const image of this.state.images) {
          try { await media.inspect(image.localPath); }
          catch (err) {
            image.missing = !(await media.exists(image.localPath));
            this.save(); this.render();
            throw new Error(image.missing ? '部分截图已失效，请重新选择' : (err.message || '截图上传失败，请重试'));
          }
          if (!this.isActive(epoch)) return;
        }
        attempt = attempt || reportState.createAttempt(this.state);
        this.state.attempt = attempt;
        if (!this.save()) return;
        for (const image of attempt.images) {
          if (image.fileId) continue;
          const prepared = payload(await api.prepareReportEvidence({ sessionId: this.sessionId,
            submissionId: attempt.submissionId, imageId: image.imageId, extension: image.extension }), '截图上传失败，请重试');
          if (!this.isActive(epoch)) return;
          if (!prepared.cloudPath) throw new Error('截图上传失败，请重试');
          const uploaded = await wx.cloud.uploadFile({ cloudPath: prepared.cloudPath, filePath: image.localPath });
          if (!this.isActive(epoch)) return;
          if (!uploaded.fileID) throw new Error('截图上传失败，请重试');
          image.fileId = uploaded.fileID;
          if (!this.save()) return;
        }
      }
      if (!this.isActive(epoch)) return;
      // Persist the frozen material BEFORE dispatch: process termination may lose the response.
      attempt.phase = 'unknown';
      if (!this.save()) return;
      dispatched = true;
      const result = payload(await api.submitReport(reportState.requestBody(this.sessionId, attempt)), '提交结果暂未确认，请重试');
      if (!this.isActive(epoch)) return;
      if (!isReceipt(result, attempt)) throw new Error('提交结果暂未确认，请重试');
      this.complete(attempt, epoch);
    } catch (err) {
      if (!this.isActive(epoch)) return;
      if (attempt && attempt.phase === 'unknown') {
        // A 4xx alone cannot prove an earlier parallel request has stopped. Only the
        // server's transactional rejection receipt permits editing this material.
        const settled = err.settlement;
        if (dispatched && settled && settled.settled === true && settled.rejected === true
          && settled.submissionId === attempt.submissionId) { this.state.attempt = null; this.save(); }
        this.toast(err.definite ? err.message : '提交结果暂未确认，请重试');
      } else {
        this.toast(err.definite ? err.message : (['部分截图已失效，请重新选择', '单张图片不能超过10MB', '暂不支持该图片格式'].includes(err.message)
          ? err.message : '截图上传失败，请重试'));
      }
    } finally {
      if (this.isActive(epoch)) { this.setData({ busy: false }); this.render(); }
    }
  },
  complete(attempt, epoch) {
    if (!this.isActive(epoch)) return;
    const cleared = reportState.clearSuccess(this.owner, this.sessionId, attempt);
    if (!cleared) { this.toast('提交成功'); this.setData({ succeeded: true, locked: true }); return; }
    this.state = cleared.state;
    cleared.paths.forEach(path => media.removeFile(path));
    this.render({ succeeded: true, locked: true, loading: false });
    wx.showToast({ title: '提交成功', icon: 'none', duration: 2000 });
    this.stopReturn();
    this.returnTimer = setTimeout(() => {
      if (!this.isActive(epoch) || reportState.read(this.owner, this.sessionId).revision !== cleared.state.revision) return;
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
      const previous = pages[pages.length - 2];
      if (previous && previous.route === 'pages/chat/index' && (previous.sessionId || (previous.options || {}).sessionId) === this.sessionId) {
        wx.navigateBack({ delta: 1 });
      } else {
        wx.redirectTo({ url: `/pages/chat/index?sessionId=${encodeURIComponent(this.sessionId)}` });
      }
    }, 2000);
  },
});

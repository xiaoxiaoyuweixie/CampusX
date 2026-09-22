const { api } = require('../../api/index.js');
const router = require('../../utils/router.js');
const storage = require('../../utils/storage.js');
const chatState = require('../../utils/chat-state.js');
const { withMessageTimes } = require('../../utils/chat-presentation.js');
const media = require('../../utils/chat-media.js');
const unread = require('../../utils/unread.js');

function unavailable(reason = '正在确认聊天权限') {
  return { canSend: false, sendReason: reason, wechat: { available: false, reason }, phone: { available: false, reason } };
}
function payload(res) {
  const result = res && res.result;
  if (!result || result.code !== 0) {
    const err = new Error(result && result.code < 50000 ? result.message : '操作失败，请重试');
    err.business = !!result && result.code < 50000;
    throw err;
  }
  return result.data;
}
function imageStyle(image = {}) {
  const width = Number(image.width), height = Number(image.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 'width: 340rpx; height: 340rpx;';
  const scale = 340 / Math.max(width, height);
  return `width: ${width * scale}rpx; height: ${height * scale}rpx;`;
}
function avatarSource(avatar, name) {
  const nickname = typeof name === 'string' && name.trim() ? name.trim() : '校园用户';
  return { url: typeof avatar === 'string' ? avatar : '', initial: Array.from(nickname)[0] };
}

Page({
  data: {
    sessionId: '', session: null, messages: [], input: '', scrollToView: '', loading: true,
    loadFailed: false, permissions: unavailable(), picking: false, keyboardHeight: 0,
    contactOpen: false, contactBusy: false, maskedWechat: '', contactReason: '', hasMore: false,
    avatars: { me: avatarSource(), other: avatarSource() },
  },
  onLoad(options) {
    const user = storage.get('userInfo', {});
    if (!user.logged || !user.openid) { wx.redirectTo({ url: '/pages/login/index' }); return; }
    this.owner = user.openid;
    this.sessionId = options.sessionId || '';
    if (!this.sessionId) { this.toast('缺少会话信息'); return; }
    const saved = chatState.read(this.owner, this.sessionId);
    this.outbox = saved.outbox;
    this.revision = saved.revision;
    this.remote = [];
    this.inflight = new Set();
    this.imageSizes = new Map();
    this.avatarUrls = {};
    this.failedAvatars = {};
    this.page = 1;
    this.setData({ sessionId: this.sessionId, input: saved.draft });
    this.renderMessages();
  },
  onShow() {
    if (!this.sessionId) return;
    if (!this.isCurrent()) { wx.redirectTo({ url: '/pages/login/index' }); return; }
    this.visible = true;
    this.renderMessages();
    this.loadMessages(true);
    this.stopPolling();
    this.timer = setInterval(() => this.loadMessages(false), 5000);
  },
  onReady() { this.measureList(); },
  onHide() { this.visible = false; this.stopPolling(); this.persist(); },
  onUnload() { this.visible = false; this.stopPolling(); this.persist(); this.disposed = true; },
  stopPolling() { if (this.timer) clearInterval(this.timer); this.timer = null; },
  isCurrent() { return !this.disposed && this.owner === (storage.get('userInfo', {}) || {}).openid; },
  toast(title, success = false) { wx.showToast({ title, icon: 'none', duration: success ? 2000 : 3000 }); },
  persist() {
    if (!this.owner || !this.sessionId || this.disposed) return;
    chatState.write(this.owner, this.sessionId, { draft: this.data.input, revision: this.revision, outbox: this.outbox || [] });
  },
  onInput(e) {
    this.revision += 1;
    this.setData({ input: e.detail.value });
    this.persist();
  },
  measureList() {
    if (!wx.createSelectorQuery) return;
    wx.createSelectorQuery().in(this).select('.list').boundingClientRect(rect => {
      if (rect) this.listHeight = rect.height;
    }).exec();
  },
  onScroll(e) {
    if (this.listHeight) this.nearBottom = e.detail.scrollHeight - e.detail.scrollTop - this.listHeight < 80;
  },
  onKeyboardHeight(e) {
    this.setData({ keyboardHeight: Math.max(0, e.detail.height || 0) }, () => this.measureList());
  },
  onProductTap() { if (this.data.session) router.toDetail(this.data.session.productId); },
  onReport() {
    if (!this.isCurrent() || !this.sessionId || this.reportNavigating) return;
    this.reportNavigating = true;
    wx.navigateTo({ url: `/pages/report/index?sessionId=${encodeURIComponent(this.sessionId)}`,
      complete: () => { this.reportNavigating = false; } });
  },
  applyPermissions(state) {
    this.setData({ permissions: state, contactReason: state.wechat.reason || '', maskedWechat: state.wechat.masked || '' });
  },
  renderMessages(scroll = false) {
    if (!this.isCurrent()) return;
    const user = storage.get('userInfo', {}) || {};
    const session = this.data.session || {};
    const avatars = { me: avatarSource(user.avatar, user.nickname), other: avatarSource(session.avatar, session.name) };
    Object.keys(avatars).forEach(from => {
      const url = avatars[from].url;
      if (this.avatarUrls[from] !== url) this.failedAvatars[from] = '';
      this.avatarUrls[from] = url;
      if (url && this.failedAvatars[from] === url) avatars[from].url = '';
    });
    const list = withMessageTimes(chatState.mergeMessages(this.remote || [], this.outbox || [])).map(item => item.type === 'image'
      ? { ...item, imageStyle: imageStyle(this.imageSizes.get(item.clientMessageId || item.id) || item.image || {}) }
      : item);
    const last = list[list.length - 1];
    const previous = this.data.messages[this.data.messages.length - 1];
    const update = { messages: list, avatars };
    if (scroll || (last && (!previous || (previous.id !== last.id && this.nearBottom !== false)))) {
      update.scrollToView = last ? `msg-${last.id}` : '';
    }
    this.setData(update);
  },
  onAvatarError(e) {
    if (!this.isCurrent()) return;
    const { from, url } = e.currentTarget.dataset;
    // An old image's delayed failure must not hide a newly loaded avatar.
    if (!['me', 'other'].includes(from) || !url || this.avatarUrls[from] !== url) return;
    this.failedAvatars[from] = url;
    this.renderMessages();
  },
  acknowledge(message) {
    const item = this.outbox.find(entry => entry.clientMessageId === message.clientMessageId);
    if (item && chatState.acknowledgedDraft(this.data.input, this.revision, item)) this.setData({ input: '' });
    this.outbox = this.outbox.filter(entry => entry.clientMessageId !== message.clientMessageId);
    if (item && item.image) media.removeFile(item.image.localPath);
    const index = this.remote.findIndex(entry => entry.id === message.id);
    if (index < 0) this.remote.push(message);
    else this.remote[index] = { ...this.remote[index], ...message, image: message.image && { ...this.remote[index].image, ...message.image } };
    this.persist();
  },
  async loadMessages(showLoading = false, older = false) {
    if (this.fetching || !this.isCurrent()) return;
    this.fetching = true;
    if (showLoading) this.setData({ loading: true });
    try {
      const result = payload(await api.getMessages({ sessionId: this.sessionId, page: older ? this.page + 1 : 1, pageSize: 50 }));
      if (!this.isCurrent()) return;
      if (older) this.page += 1;
      result.list.forEach(message => this.acknowledge(message));
      this.setData({ session: result.session, loadFailed: false, hasMore: this.remote.length < result.total });
      this.applyPermissions(result.permissions);
      if (result.session && result.session.name) wx.setNavigationBarTitle({ title: result.session.name });
      this.renderMessages(showLoading && !older);
      unread.refresh();
    } catch (err) {
      if (this.isCurrent()) {
        this.applyPermissions(unavailable(err.business ? err.message : '暂时无法确认聊天权限，请重试'));
        this.setData({ loadFailed: true });
      }
    } finally {
      this.fetching = false;
      if (this.isCurrent()) this.setData({ loading: false });
    }
  },
  onRetryLoad() { this.loadMessages(true); },
  onLoadOlder() { if (this.data.hasMore) this.loadMessages(false, true); },
  async checkSend() {
    const state = payload(await api.getChatState(this.sessionId));
    if (!this.isCurrent()) throw new Error('ACCOUNT_CHANGED');
    this.applyPermissions(state);
    if (!state.canSend) { const err = new Error(state.sendReason); err.business = true; throw err; }
  },
  async onSend() {
    const text = this.data.input;
    const error = chatState.textError(text);
    if (error) { this.toast(error); return; }
    const previous = this.outbox.find(item => item.type === 'text' && item.text === text && item.draftRevision === this.revision);
    if (previous) { await this.submit(previous); return; }
    const clientMessageId = chatState.newId();
    const message = { id: clientMessageId, clientMessageId, type: 'text', text, from: 'me',
      draftRevision: this.revision, createdTimestamp: Date.now(), status: 'sending' };
    this.outbox.push(message);
    this.persist();
    this.renderMessages(true);
    await this.submit(message);
  },
  async submit(message) {
    const id = message.clientMessageId;
    if (!this.isCurrent() || this.inflight.has(id)) return;
    this.inflight.add(id);
    message.status = 'sending';
    this.persist();
    this.renderMessages();
    try {
      await this.checkSend();
      if (message.type === 'text') {
        const error = chatState.textError(message.text);
        if (error) throw new Error(error);
      } else {
        const image = message.image;
        const prepared = payload(await api.prepareChatImage({ sessionId: this.sessionId, clientMessageId: id, extension: image.extension, size: image.size }));
        if (!this.isCurrent()) return;
        if (prepared.message) {
          this.acknowledge(prepared.message);
          this.renderMessages();
          this.loadMessages(false);
          return;
        }
        if (!image.fileID) {
          const upload = await wx.cloud.uploadFile({ cloudPath: prepared.cloudPath, filePath: image.localPath });
          if (!this.isCurrent()) return;
          image.fileID = upload.fileID;
          this.persist();
        }
      }
      const sent = payload(await api.sendMessage({ sessionId: this.sessionId, clientMessageId: id,
        type: message.type, content: message.text, image: message.type === 'image' ? message.image : null,
        createdTimestamp: message.createdTimestamp }));
      if (!this.isCurrent()) return;
      this.acknowledge(sent.message);
      this.renderMessages();
      this.loadMessages(false);
    } catch (err) {
      if (this.isCurrent()) {
        const pending = this.outbox.find(item => item.clientMessageId === id);
        if (pending) {
          pending.status = 'failed';
          if (pending.image) pending.image.fileID = '';
          pending.error = err.business ? err.message : (message.type === 'image' ? '图片发送失败，请重试' : '消息发送失败，请重试');
          this.toast(pending.error);
          this.persist();
          this.renderMessages();
        }
      }
    } finally { this.inflight.delete(id); }
  },
  onRetryMessage(e) {
    const item = this.outbox.find(entry => entry.clientMessageId === e.currentTarget.dataset.id);
    if (item) this.submit(item);
  },
  async onChooseImages() {
    if (this.data.picking || !this.isCurrent()) return;
    this.setData({ picking: true });
    try {
      await this.checkSend();
      const selected = await media.selectImages();
      if (!this.isCurrent()) return;
      if (selected.tempFiles.length > 9) { this.toast('单次最多选择9张图片'); return; }
      await this.checkSend();
      const batch = [];
      const start = Date.now() - selected.tempFiles.length;
      for (let i = 0; i < selected.tempFiles.length; i += 1) {
        try {
          const image = await media.inspectImage(selected.tempFiles[i]);
          if (!this.isCurrent()) { media.removeFile(image.localPath); return; }
          const id = chatState.newId();
          const item = { id, clientMessageId: id, type: 'image', text: '[图片]', image,
            from: 'me', createdTimestamp: start + i, status: 'sending' };
          batch.push(item);
          this.outbox.push(item);
        } catch (err) { this.toast(['单张图片不能超过10MB', '暂不支持该图片格式'].includes(err.message) ? err.message : '图片读取失败，请重新选择'); }
      }
      this.persist();
      this.renderMessages(true);
      // Sequential submission keeps selection order; one failure does not stop the batch.
      for (const item of batch) { if (this.isCurrent()) await this.submit(item); }
    } catch (err) {
      if (this.isCurrent() && !media.cancelled(err)) this.toast(err.business ? err.message : '无法使用相机或相册，请检查权限后重试');
    } finally { if (this.isCurrent()) this.setData({ picking: false }); }
  },
  async onWechat() {
    if (this.data.contactBusy || !this.isCurrent()) return;
    this.setData({ contactBusy: true });
    try {
      // Restore the full visible page before opening; keep the input and stored draft untouched.
      if (this.data.keyboardHeight && wx.hideKeyboard) {
        try {
          await wx.hideKeyboard();
          if (this.isCurrent()) this.setData({ keyboardHeight: 0 }, () => this.measureList());
        } catch (err) { /* A keyboard dismissal failure must not bypass contact permission checks. */ }
      }
      if (!this.isCurrent()) return;
      const result = payload(await api.getChatContact({ sessionId: this.sessionId, type: 'wechat', purpose: 'preview' }));
      if (this.isCurrent()) this.setData({ contactOpen: true, maskedWechat: result.masked, contactReason: '' });
    } catch (err) { if (this.isCurrent()) { this.toast(err.message); this.loadMessages(false); } }
    finally { if (this.isCurrent()) this.setData({ contactBusy: false }); }
  },
  onCloseContact() { this.setData({ contactOpen: false, maskedWechat: '', contactReason: '' }); },
  async onCopyWechat() {
    if (this.data.contactBusy || !this.isCurrent()) return;
    this.setData({ contactBusy: true });
    try {
      const result = payload(await api.getChatContact({ sessionId: this.sessionId, type: 'wechat', purpose: 'copy' }));
      if (!this.isCurrent() || !this.data.contactOpen) return;
      this.setData({ maskedWechat: result.masked, contactReason: '' });
      try { await wx.setClipboardData({ data: result.value }); }
      catch (err) { this.toast('复制失败，请重试'); return; }
      this.toast('已复制', true);
    } catch (err) {
      if (this.isCurrent()) { this.setData({ maskedWechat: '', contactReason: err.message }); this.toast(err.message); }
    } finally { if (this.isCurrent()) this.setData({ contactBusy: false }); }
  },
  async onPhone() {
    if (this.data.contactBusy || !this.isCurrent()) return;
    this.setData({ contactBusy: true });
    try {
      const result = payload(await api.getChatContact({ sessionId: this.sessionId, type: 'phone', purpose: 'call' }));
      if (!this.isCurrent()) return;
      try { await wx.makePhoneCall({ phoneNumber: result.value }); }
      catch (err) { if (!media.cancelled(err)) this.toast('无法拨打电话，请重试'); }
    } catch (err) { if (this.isCurrent()) { this.toast(err.message); this.loadMessages(false); } }
    finally { if (this.isCurrent()) this.setData({ contactBusy: false }); }
  },
  async onPreviewImage(e) {
    const message = this.data.messages.find(item => item.id === e.currentTarget.dataset.id);
    if (!message || !message.image) return;
    try {
      const url = message.status === 'sent'
        ? payload(await api.getChatImage({ sessionId: this.sessionId, messageId: message.id })).url
        : message.image.localPath;
      if (this.isCurrent() && url) await wx.previewImage({ current: url, urls: [url] });
    } catch (err) { this.toast('图片加载失败，请重试'); }
  },
  onImageLoad(e) {
    if (!this.isCurrent()) return;
    const index = this.data.messages.findIndex(item => item.id === e.currentTarget.dataset.id);
    const { width, height } = e.detail;
    if (index < 0 || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    const message = this.data.messages[index];
    // Keep decoded dimensions across polling, including photos with rotated metadata.
    this.imageSizes.set(message.clientMessageId || message.id, { width, height });
    const style = imageStyle({ width, height });
    if (message.imageStyle !== style) this.setData({ [`messages[${index}].imageStyle`]: style });
  },
  onImageError(e) {
    const index = this.data.messages.findIndex(item => item.id === e.currentTarget.dataset.id);
    if (index >= 0) this.setData({ [`messages[${index}].imageFailed`]: true });
  },
});

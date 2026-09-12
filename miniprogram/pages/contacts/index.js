const { api } = require('../../api/index.js');
const storage = require('../../utils/storage.js');

Page({
  data: {
    contacts: null, loading: true, loadFailed: false, busy: { wechat: false, phone: false },
    editingType: '', editValue: '', saving: false, keyboardHeight: 0,
  },
  onLoad() { this.owner = (storage.get('userInfo', {}) || {}).openid; },
  onShow() {
    const user = storage.get('userInfo', {});
    if (!user.logged || !user.openid || (this.owner && this.owner !== user.openid)) {
      this.setData({ contacts: null, editingType: '' });
      wx.redirectTo({ url: '/pages/login/index' });
      return;
    }
    this.owner = user.openid;
    this.loadContacts();
  },
  onUnload() { this.closed = true; },
  isCurrent() { return !this.closed && (storage.get('userInfo', {}) || {}).openid === this.owner; },
  toast(title, success = false) { wx.showToast({ title, icon: 'none', duration: success ? 2000 : 3000 }); },
  async loadContacts() {
    if (this.fetching || this.data.busy.wechat || this.data.busy.phone) return;
    this.fetching = true;
    this.setData({ loading: true });
    try {
      const res = await api.getContacts();
      if (!res.result || res.result.code !== 0) throw new Error('LOAD_FAILED');
      if (this.isCurrent()) this.setData({ contacts: res.result.data, loadFailed: false });
    } catch (err) {
      if (this.isCurrent()) this.setData({ loadFailed: true });
    } finally {
      this.fetching = false;
      if (this.isCurrent()) this.setData({ loading: false });
    }
  },
  async onToggle(e) {
    const type = e.currentTarget.dataset.type;
    if (!this.data.contacts || this.data.loading || this.data.loadFailed || this.data.busy[type]) return;
    const before = this.data.contacts[type].enabled;
    this.setData({ [`busy.${type}`]: true, [`contacts.${type}.enabled`]: e.detail.value });
    let uncertain = false;
    try {
      const res = await api.setContactEnabled({ type, enabled: e.detail.value });
      if (!this.isCurrent()) return;
      if (!res.result || res.result.code !== 0) {
        this.setData({ [`contacts.${type}.enabled`]: before });
        this.toast('操作失败，请重试');
      } else this.setData({ [`contacts.${type}`]: res.result.data[type] });
    } catch (err) {
      uncertain = true;
      if (this.isCurrent()) {
        this.setData({ [`contacts.${type}.enabled`]: before, loadFailed: true });
        this.toast('操作失败，请重试');
      }
    } finally {
      if (this.isCurrent()) this.setData({ [`busy.${type}`]: false });
      if (uncertain && this.isCurrent()) this.loadContacts();
    }
  },
  onEdit(e) {
    const type = e.currentTarget.dataset.type;
    if (this.data.loading || this.data.loadFailed || this.data.busy[type]) return;
    this.setData({ editingType: type, editValue: this.data.contacts[type].value });
  },
  onEditInput(e) { this.setData({ editValue: e.detail.value }); },
  onKeyboardHeight(e) { this.setData({ keyboardHeight: Math.max(0, e.detail.height || 0) }); },
  onEditorClose() {
    this.setData({ editingType: '', editValue: '', keyboardHeight: 0 });
  },
  async onSave() {
    const type = this.data.editingType;
    if (!type || this.data.saving || this.data.loadFailed || this.data.loading) return;
    const value = this.data.editValue;
    this.setData({ saving: true, [`busy.${type}`]: true });
    let uncertain = false;
    try {
      const res = await api.saveContact({ type, value });
      if (!this.isCurrent()) return;
      if (!res.result || res.result.code !== 0) this.toast('保存失败，请重试');
      else {
        this.setData({ [`contacts.${type}`]: res.result.data[type] });
        this.onEditorClose();
        this.toast('已保存', true);
      }
    } catch (err) {
      uncertain = true;
      if (this.isCurrent()) {
        this.setData({ loadFailed: true });
        this.toast('保存失败，请重试');
      }
    } finally {
      if (this.isCurrent()) this.setData({ saving: false, [`busy.${type}`]: false });
      if (uncertain && this.isCurrent()) this.loadContacts();
    }
  },
});

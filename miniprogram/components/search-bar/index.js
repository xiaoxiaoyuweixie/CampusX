Component({
  properties: {
    placeholder: { type: String, value: '搜索想要的资源' },
    value: { type: String, value: '' },
  },
  methods: {
    onInput(e) { this.triggerEvent('input', { value: e.detail.value }); },
    onConfirm(e) { this.triggerEvent('confirm', { value: e.detail.value }); },
  },
});

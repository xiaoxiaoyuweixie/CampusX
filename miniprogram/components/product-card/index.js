Component({
  properties: {
    product: { type: Object, value: {} },
  },
  methods: {
    onTap() {
      this.triggerEvent('tap', { id: this.data.product.id });
    },
  },
});

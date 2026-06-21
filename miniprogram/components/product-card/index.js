Component({
  properties: {
    product: { type: Object, value: {} },
  },
  methods: {
    onTap() {
      const product = this.data.product || {};
      this.triggerEvent('tap', { id: product._id || product.id });
    },
  },
});

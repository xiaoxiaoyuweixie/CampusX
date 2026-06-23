Component({
  properties: {
    product: { type: Object, value: {} },
  },
  methods: {
    onTap() {
      const product = this.data.product || {};
      const id = product.productId || product._id || product.id;
      if (!id) return;
      this.triggerEvent('producttap', { id }, { bubbles: false, composed: false });
    },
  },
});

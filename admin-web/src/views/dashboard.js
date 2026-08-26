export async function loadDashboard({ adminCall, renderApp }) {
  const data = await adminCall('getDashboard');
  const cards = [
    ['用户总数', data.userCount],
    ['禁用用户', data.disabledUserCount],
    ['商品总数', data.productCount],
    ['在售商品', data.onSaleCount],
    ['已下架', data.offShelfCount],
    ['已售出', data.soldCount],
    ['分类数', data.categoryCount],
    ['会话数', data.sessionCount],
    ['消息数', data.messageCount],
  ];

  renderApp(`
    <div class="metric-grid">
      ${cards.map(([label, value]) => `
        <article class="metric-card">
          <span>${label}</span>
          <strong>${value ?? 0}</strong>
        </article>
      `).join('')}
    </div>
  `);
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatDate(value) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN', { hour12: false });
}

export function statusText(status) {
  const map = {
    enabled: '启用',
    disabled: '禁用',
    on_sale: '在售',
    off_shelf: '已下架',
    sold: '已售出',
    active: '正常',
  };
  return map[status] || status || '-';
}

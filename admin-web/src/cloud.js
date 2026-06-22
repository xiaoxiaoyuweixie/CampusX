const ADMIN_API_URL = import.meta.env.VITE_ADMIN_API_URL || '';

export async function callAdmin(action, data = {}) {
  if (!ADMIN_API_URL) {
    throw new Error('缺少 VITE_ADMIN_API_URL，请配置 adminService HTTP 访问地址');
  }

  const res = await fetch(ADMIN_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data }),
  });

  const text = await res.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (err) {
    throw new Error(`HTTP 响应不是 JSON：${text.slice(0, 120)}`);
  }

  if (!res.ok) {
    throw new Error((payload && payload.message) || `HTTP ${res.status}`);
  }

  return payload;
}

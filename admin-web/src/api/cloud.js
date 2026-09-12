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
    throw new Error('管理端接口返回格式异常，请检查 adminService HTTP 访问地址');
  }

  if (!res.ok) {
    throw new Error((payload && payload.message) || `请求失败，请稍后重试（${res.status}）`);
  }

  return payload;
}

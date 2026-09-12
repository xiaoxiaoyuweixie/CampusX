const TOKEN_KEY = 'campusx_admin_token';
const ADMIN_KEY = 'campusx_admin_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setSession(token, admin) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ADMIN_KEY, JSON.stringify(admin || {}));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ADMIN_KEY);
}

export function getAdmin() {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_KEY) || '{}');
  } catch (err) {
    return {};
  }
}

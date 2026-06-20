function get(key, fallback) {
  try {
    const v = wx.getStorageSync(key);
    return v === '' || v === undefined ? fallback : v;
  } catch (e) {
    return fallback;
  }
}
function set(key, value) {
  try { wx.setStorageSync(key, value); } catch (e) {}
}
function remove(key) {
  try { wx.removeStorageSync(key); } catch (e) {}
}
function getFavorites() { return get('favorites', []); }
function isFavorite(id) { return getFavorites().includes(id); }
function toggleFavorite(id) {
  const favs = getFavorites();
  const i = favs.indexOf(id);
  if (i >= 0) favs.splice(i, 1); else favs.push(id);
  set('favorites', favs);
  return favs.includes(id);
}
function getToken() { return get('token', ''); }

module.exports = { get, set, remove, getFavorites, isFavorite, toggleFavorite, getToken };
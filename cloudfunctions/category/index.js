const ok = (data = null, message = 'success') => ({ code: 0, message, data });
const fail = (message = 'error', code = 50000, data = null) => ({ code, message, data });

const seed = [
  { id: 'digital', name: '数码电子', icon: '📱', sort: 1 },
  { id: 'book', name: '教材书籍', icon: '📚', sort: 2 },
  { id: 'daily', name: '生活用品', icon: '🧴', sort: 3 },
  { id: 'sport', name: '运动户外', icon: '🏀', sort: 4 },
  { id: 'other', name: '其他', icon: '🧩', sort: 99 },
];

exports.main = async (event) => {
  try {
    const { action } = event;
    if (action !== 'getCategories') return fail('unsupported action', 40001);
    return ok(seed);
  } catch (err) { return fail(err.message); }
};

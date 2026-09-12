function parsePagination(data = {}) {
  const page = Math.max(Number(data.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(data.pageSize || 20), 1), 100);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

module.exports = { parsePagination };

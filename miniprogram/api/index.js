const callFunction = (name, data = {}) => {
  if (!wx.cloud) {
    return Promise.reject(new Error('wx.cloud 未初始化'));
  }
  return wx.cloud.callFunction({ name, data });
};

const api = {
  login: (data) => callFunction('login', { action: 'login', data }),
  getUserInfo: () => callFunction('user', { action: 'getUserInfo' }),
  updateUserInfo: (data) => callFunction('user', { action: 'updateUserInfo', data }),
  getDashboard: () => callFunction('user', { action: 'getDashboard' }),

  getCategories: () => callFunction('category', { action: 'getCategories' }),

  createProduct: (data) => callFunction('product', { action: 'createProduct', data }),
  listProducts: (data) => callFunction('product', { action: 'listProducts', data }),
  getRecommendedProducts: (data) => callFunction('product', { action: 'getRecommendedProducts', data }),
  getProductDetail: (id) => callFunction('product', { action: 'getProductDetail', data: { id } }),
  updateProductStatus: (data) => callFunction('product', { action: 'updateProductStatus', data }),
  updateProduct: (data) => callFunction('product', { action: 'updateProduct', data }),
  deleteProduct: (id) => callFunction('product', { action: 'deleteProduct', data: { id } }),
  getMyProducts: (data) => callFunction('product', { action: 'getMyProducts', data }),

  addFavorite: (productId) => callFunction('favorite', { action: 'addFavorite', data: { productId } }),
  removeFavorite: (productId) => callFunction('favorite', { action: 'removeFavorite', data: { productId } }),
  listFavorites: (data) => callFunction('favorite', { action: 'listFavorites', data }),
  checkFavorite: (productId) => callFunction('favorite', { action: 'checkFavorite', data: { productId } }),

  openChatSession: (productId) => callFunction('chatService', { action: 'openSession', data: { productId } }),
  createSession: (data) => callFunction('chatService', { action: 'openSession', data }),
  getSessionList: (data) => callFunction('chatService', { action: 'getSessionList', data }),
  getMessages: (data) => {
    const payload = typeof data === 'string' ? { sessionId: data } : data;
    return callFunction('chatService', { action: 'getMessages', data: payload });
  },
  sendMessage: (data) => callFunction('chatService', { action: 'sendMessage', data }),
  markRead: (sessionId) => callFunction('chatService', { action: 'markRead', data: { sessionId } }),

  systemNoticeList: () => callFunction('message', { action: 'systemNoticeList' }),
  unreadCount: () => callFunction('message', { action: 'unreadCount' }),

  getUploadPath: (ext) => callFunction('upload', { action: 'getUploadPath', data: { ext } }),

  search: (data) => callFunction('search', { action: 'search', data }),
};

module.exports = { callFunction, api };

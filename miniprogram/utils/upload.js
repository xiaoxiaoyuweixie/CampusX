const storage = require('./storage.js');

const normalizeExt = (filePath = '') => {
  const match = filePath.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return (match && match[1] ? match[1] : 'png').toLowerCase();
};

const getCurrentOpenid = () => {
  const userInfo = storage.get('userInfo', {});
  return userInfo.openid || '';
};

const buildCloudPath = ({ type, filePath = '', openid = '', productId = '' }) => {
  const ext = normalizeExt(filePath);
  const timestamp = Date.now();

  if (type === 'avatar') {
    if (!openid) throw new Error('未登录，无法上传头像');
    return `avatar/${openid}.png`;
  }

  if (type === 'product') {
    if (!productId) throw new Error('缺少 productId');
    if (!openid) throw new Error('未登录，无法上传商品图片');
    return `products/${productId}/${timestamp}.png`;
  }

  if (type === 'system') {
    return `system/${timestamp}.${ext}`;
  }

  throw new Error('不支持的上传类型');
};

const uploadImage = async ({ filePath, type = 'product', productId = '', openid = '' }) => {
  if (!wx.cloud || !wx.cloud.uploadFile) {
    throw new Error('wx.cloud 未初始化');
  }

  const uid = openid || getCurrentOpenid();
  const cloudPath = buildCloudPath({ type, filePath, openid: uid, productId });
  const res = await wx.cloud.uploadFile({ cloudPath, filePath });
  const fileID = res.fileID;
  const temp = await wx.cloud.getTempFileURL({ fileList: [fileID] });
  const tempFile = (temp.fileList && temp.fileList[0]) || {};

  return {
    fileID,
    url: tempFile.tempFileURL || '',
  };
};

const uploadImages = async ({ filePaths = [], type = 'product', productId = '', openid = '' }) => {
  const results = [];
  for (const filePath of filePaths) {
    results.push(await uploadImage({ filePath, type, productId, openid }));
  }
  return results;
};

module.exports = { uploadImage, uploadImages, buildCloudPath };

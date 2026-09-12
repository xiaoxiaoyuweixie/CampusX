function cancelled(err) { return /cancel/i.test((err || {}).errMsg || ''); }
async function selectImages() {
  const choice = await wx.showActionSheet({ itemList: ['拍照', '从相册选择'] });
  return wx.chooseMedia({ count: choice.tapIndex === 0 ? 1 : 9, mediaType: ['image'],
    sourceType: [choice.tapIndex === 0 ? 'camera' : 'album'], sizeType: ['original'] });
}
async function inspectImage(file) {
  const info = await wx.getImageInfo({ src: file.tempFilePath });
  const stat = await new Promise((resolve, reject) => wx.getFileSystemManager().stat({ path: file.tempFilePath, success: resolve, fail: reject }));
  if (stat.stats.size > 10 * 1024 * 1024) throw new Error('单张图片不能超过10MB');
  const extension = info.type === 'jpeg' ? 'jpg' : info.type;
  if (!['jpg', 'png', 'webp'].includes(extension)) throw new Error('暂不支持该图片格式');
  const saved = await new Promise((resolve, reject) => wx.getFileSystemManager().saveFile({ tempFilePath: file.tempFilePath, success: resolve, fail: reject }));
  return { localPath: saved.savedFilePath, size: stat.stats.size, extension, width: info.width, height: info.height };
}
function removeFile(path) {
  if (!path) return;
  wx.getFileSystemManager().removeSavedFile({ filePath: path, fail() {} });
}
module.exports = { cancelled, selectImages, inspectImage, removeFile };

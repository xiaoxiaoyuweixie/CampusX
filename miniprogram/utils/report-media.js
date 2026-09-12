const { cancelled, removeFile } = require('./chat-media');
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function fileCall(method, options) {
  return new Promise((resolve, reject) => wx.getFileSystemManager()[method]({ ...options, success: resolve, fail: reject }));
}
function ascii(bytes, start, end) { return String.fromCharCode(...bytes.slice(start, end)); }
function imageFormat(data) {
  const bytes = new Uint8Array(data);
  if (bytes.length < 12) return '';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217) return 'jpg';
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index])) {
    let offset = 8, header = false, pixels = false;
    while (offset + 12 <= bytes.length) {
      const length = view.getUint32(offset);
      if (offset + length + 12 > bytes.length) return '';
      const type = ascii(bytes, offset + 4, offset + 8);
      if (type === 'acTL') return '';
      if (type === 'IHDR') header = length === 13;
      if (type === 'IDAT') pixels = true;
      if (type === 'IEND') return header && pixels ? 'png' : '';
      offset += length + 12;
    }
  }
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') {
    if (view.getUint32(4, true) + 8 !== bytes.length) return '';
    let offset = 12, pixels = false;
    while (offset + 8 <= bytes.length) {
      const type = ascii(bytes, offset, offset + 4), length = view.getUint32(offset + 4, true);
      if (offset + 8 + length > bytes.length) return '';
      if (type === 'ANIM' || type === 'ANMF' || (type === 'VP8X' && length && (bytes[offset + 8] & 2))) return '';
      if (type === 'VP8 ' || type === 'VP8L') pixels = true;
      offset += 8 + length + (length % 2);
    }
    return pixels && offset === bytes.length ? 'webp' : '';
  }
  return '';
}
async function inspect(path) {
  const stat = await fileCall('stat', { path });
  if (stat.stats.size > MAX_IMAGE_BYTES) throw new Error('单张图片不能超过10MB');
  const data = await fileCall('readFile', { filePath: path });
  if (!data.data || data.data.byteLength > MAX_IMAGE_BYTES) throw new Error('单张图片不能超过10MB');
  const extension = imageFormat(data.data);
  if (!extension) throw new Error('暂不支持该图片格式');
  // The native decoder also checks that the selected bytes are an actual image.
  const info = await wx.getImageInfo({ src: path });
  return { extension, size: data.data.byteLength, width: info.width, height: info.height };
}
async function selectImages(count) {
  const choice = await wx.showActionSheet({ itemList: ['拍照', '从相册选择'] });
  return wx.chooseMedia({ count: choice.tapIndex === 0 ? 1 : count, mediaType: ['image'],
    sourceType: [choice.tapIndex === 0 ? 'camera' : 'album'], sizeType: ['original'] });
}
async function saveImage(file) {
  const details = await inspect(file.tempFilePath);
  const saved = await fileCall('saveFile', { tempFilePath: file.tempFilePath });
  return { ...details, localPath: saved.savedFilePath };
}
async function exists(path) {
  if (!path) return false;
  try { await fileCall('stat', { path }); return true; } catch (err) { return false; }
}
module.exports = { MAX_IMAGE_BYTES, cancelled, removeFile, imageFormat, inspect, selectImages, saveImage, exists };

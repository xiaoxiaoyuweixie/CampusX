const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const crcTable = Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = (value >>> 8) ^ crcTable[(value ^ byte) & 255];
  return (value ^ 0xffffffff) >>> 0;
}

// Read dimensions and animation markers from the uploaded bytes, never client metadata.
function imageInfo(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return jpeg(bytes);
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return png(bytes);
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return webp(bytes);
  return null;
}
function jpeg(bytes) {
  let offset = 2, width = 0, height = 0, scan = false;
  while (offset < bytes.length) {
    if (bytes[offset++] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9) return offset === bytes.length && width && height && scan ? { format: 'jpg', width, height } : null;
    if (marker === 0x00 || marker === 0xd8 || marker === undefined) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return null;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) return null;
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (length < 8) return null;
      height = bytes.readUInt16BE(offset + 3); width = bytes.readUInt16BE(offset + 5);
    }
    offset += length;
    if (marker === 0xda) {
      scan = true;
      while (offset < bytes.length) {
        if (bytes[offset] !== 0xff) { offset++; continue; }
        if (bytes[offset + 1] === 0 || (bytes[offset + 1] >= 0xd0 && bytes[offset + 1] <= 0xd7)) { offset += 2; continue; }
        break;
      }
    }
  }
  return null;
}
function png(bytes) {
  let offset = 8, width = 0, height = 0, pixels = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    if (offset + length + 12 > bytes.length) return null;
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (crc32(bytes.subarray(offset + 4, offset + 8 + length)) !== bytes.readUInt32BE(offset + 8 + length)) return null;
    if (type === 'acTL' || type === 'fcTL' || type === 'fdAT') return null;
    if (offset === 8 && (type !== 'IHDR' || length !== 13)) return null;
    if (type === 'IHDR') {
      if (offset !== 8 || length !== 13) return null;
      width = bytes.readUInt32BE(offset + 8); height = bytes.readUInt32BE(offset + 12);
      const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      if (!(depths[bytes[offset + 17]] || []).includes(bytes[offset + 16])
        || bytes[offset + 18] || bytes[offset + 19] || bytes[offset + 20] > 1) return null;
    }
    if (type === 'IDAT' && length > 0) pixels = true;
    offset += length + 12;
    if (type === 'IEND') return length === 0 && offset === bytes.length && width && height && pixels ? { format: 'png', width, height } : null;
  }
  return null;
}
function webp(bytes) {
  if (bytes.readUInt32LE(4) + 8 !== bytes.length) return null;
  let offset = 12, width = 0, height = 0, pixels = false;
  while (offset + 8 <= bytes.length) {
    const type = bytes.toString('ascii', offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4), start = offset + 8;
    if (start + length > bytes.length) return null;
    if (type === 'ANIM' || type === 'ANMF') return null;
    if (type === 'VP8X') {
      if (length !== 10 || (bytes[start] & 2)) return null;
      width = bytes.readUIntLE(start + 4, 3) + 1; height = bytes.readUIntLE(start + 7, 3) + 1;
    }
    if (type === 'VP8 ') {
      if (length < 10 || (bytes[start] & 1) || !bytes.subarray(start + 3, start + 6).equals(Buffer.from([0x9d, 0x01, 0x2a]))) return null;
      const frameWidth = bytes.readUInt16LE(start + 6) & 0x3fff, frameHeight = bytes.readUInt16LE(start + 8) & 0x3fff;
      if ((width && width !== frameWidth) || (height && height !== frameHeight)) return null;
      width = frameWidth; height = frameHeight; pixels = true;
    }
    if (type === 'VP8L') {
      if (length < 5 || bytes[start] !== 0x2f || (bytes[start + 4] & 0xe0)) return null;
      const bits = bytes.readUInt32LE(start + 1);
      const frameWidth = (bits & 0x3fff) + 1, frameHeight = ((bits >>> 14) & 0x3fff) + 1;
      if ((width && width !== frameWidth) || (height && height !== frameHeight)) return null;
      width = frameWidth; height = frameHeight; pixels = true;
    }
    offset += 8 + length + (length % 2);
  }
  return offset === bytes.length && width && height && pixels ? { format: 'webp', width, height } : null;
}
module.exports = { MAX_IMAGE_BYTES, imageInfo };

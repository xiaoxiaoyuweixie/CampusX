const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// Inspect bytes, not a caller-supplied filename. Animated PNG/WebP are excluded.
function imageFormat(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return '';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    && buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9) return 'jpg';
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    let offset = 8;
    let header = false;
    let pixels = false;
    while (offset + 12 <= buffer.length) {
      const length = buffer.readUInt32BE(offset);
      if (offset + length + 12 > buffer.length) return '';
      const type = buffer.toString('ascii', offset + 4, offset + 8);
      if (type === 'acTL') return '';
      if (type === 'IHDR') header = length === 13;
      if (type === 'IDAT') pixels = true;
      if (type === 'IEND') return header && pixels ? 'png' : '';
      offset += length + 12;
    }
  }
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    if (buffer.readUInt32LE(4) + 8 !== buffer.length) return '';
    let offset = 12;
    let pixels = false;
    while (offset + 8 <= buffer.length) {
      const type = buffer.toString('ascii', offset, offset + 4);
      const length = buffer.readUInt32LE(offset + 4);
      if (offset + 8 + length > buffer.length) return '';
      if (type === 'ANIM' || type === 'ANMF' || (type === 'VP8X' && length && (buffer[offset + 8] & 2))) return '';
      if (type === 'VP8 ' || type === 'VP8L') pixels = true;
      offset += 8 + length + (length % 2);
    }
    return pixels && offset === buffer.length ? 'webp' : '';
  }
  return '';
}
module.exports = { MAX_IMAGE_BYTES, imageFormat };

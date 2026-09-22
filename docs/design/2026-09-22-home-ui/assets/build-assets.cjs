// Rebuild runtime images from the exact Figma source bytes saved beside this file.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../../..');
const sharp = require(path.join(root, 'cloudfunctions/reportService/node_modules/sharp'));
const imageRoot = path.join(root, 'miniprogram/images');
const sourceIds = {
  banner: '242:2035',
  'category-digital': '497:2244',
  'category-kaoyan': '497:2252',
  'category-book': '497:2259',
  'category-skill': '497:2264',
  'category-dorm': '498:2271',
  location: '242:2057',
  search: 'I243:1911;243:1889',
  campus: 'I243:1942;258:76',
  'tab-home': '501:282',
  'tab-home-active': '501:286',
  'tab-category': '501:294',
  'tab-category-active': '501:298',
  'tab-publish': '503:97',
  'tab-publish-active': '503:100',
  'tab-message': '501:318',
  'tab-message-active': '501:322',
  'tab-profile': '501:330',
  'tab-profile-active': '501:334'
};
const assets = [];
async function record(name, source, output, processing) {
  const bytes = fs.readFileSync(output);
  const original = fs.readFileSync(source);
  const metadata = await sharp(bytes).metadata();
  const sourceMetadata = await sharp(original).metadata();
  assets.push({
    name,
    nodeId: sourceIds[name.replace(/-unread$/, '')],
    source: path.relative(root, source),
    sourceWidth: sourceMetadata.width,
    sourceHeight: sourceMetadata.height,
    sourceBytes: original.length,
    sourceSha1: crypto.createHash('sha1').update(original).digest('hex'),
    output: path.relative(root, output),
    width: metadata.width,
    height: metadata.height,
    bytes: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    processing
  });
}
async function main() {
  fs.mkdirSync(path.join(imageRoot, 'home'), { recursive: true });
  for (const name of ['banner', 'category-digital', 'category-kaoyan', 'category-book', 'category-skill', 'category-dorm']) {
    const source = path.join(__dirname, `${name}-source.png`);
    const output = path.join(imageRoot, 'home', `${name}.png`);
    await sharp(source).resize({ width: name === 'banner' ? 1041 : 132 }).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(output);
    await record(name, source, output, 'Downsample original at 3× design display width; retain original aspect ratio and alpha. Banner uses aspectFill in page.');
  }
  for (const name of ['location', 'search', 'campus']) {
    const source = path.join(__dirname, `${name}.svg`);
    const output = path.join(imageRoot, 'home', `${name}.svg`);
    fs.copyFileSync(source, output);
    await record(name, source, output, 'Exact self-contained Figma SVG bytes.');
  }
  for (const name of Object.keys(sourceIds).filter(name => name.startsWith('tab-'))) {
    const source = path.join(__dirname, `${name}.svg`);
    const output = path.join(imageRoot, `${name}.png`);
    const { data, info } = await sharp(source, { density: 432 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let left = info.width; let top = info.height; let right = -1; let bottom = -1;
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        if (data[(y * info.width + x) * 4 + 3] === 0) continue;
        left = Math.min(left, x); top = Math.min(top, y);
        right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
    }
    const glyph = await sharp(data, { raw: info })
      .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
      .resize(66, 66, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();
    await sharp({ create: { width: 81, height: 81, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: glyph, gravity: 'centre' }]).png({ compressionLevel: 9 }).toFile(output);
    await record(name, source, output, 'Rasterize Figma SVG at 6×, remove transparent export-container padding, fit visible glyph into centered 66×66 on 81×81 transparent canvas.');
    if (name === 'tab-message' || name === 'tab-message-active') {
      const unreadOutput = path.join(imageRoot, `${name}-unread.png`);
      // Existing approved unread indicator geometry, independent from the Figma glyph.
      const dot = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="81" height="81"><circle cx="70" cy="18" r="9" fill="#FA5151"/></svg>');
      await sharp(output).composite([{ input: dot }]).png({ compressionLevel: 9 }).toFile(unreadOutput);
      await record(`${name}-unread`, source, unreadOutput, 'Same message glyph plus approved red indicator: center (70,18), radius 9 source pixels, #FA5151.');
    }
  }
  fs.writeFileSync(path.join(__dirname, '../assets.json'), JSON.stringify({
    fileKey: 'ypmVzm832Ho7LpKxfyzsnO', sectionNodeId: '514:2332', retrievedOn: '2026-09-22',
    note: 'Sources were downloaded from the live Figma design. Raster source SHA1 values match current imageHash fills. No product example content is used.',
    assets
  }, null, 2) + '\n');
  for (const asset of assets) console.log(`${asset.output}: ${asset.width}x${asset.height}, ${asset.bytes} bytes`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });

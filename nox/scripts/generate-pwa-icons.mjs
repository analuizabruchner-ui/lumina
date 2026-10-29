import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const outputDirectory = path.resolve('public/icons');
const mark = `<g fill="none" stroke="#FFFFFF" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M22 34 V78 M22 54 A20 20 0 0 1 62 54 V78"/><path d="M152 34 L192 78 M192 34 L152 78"/></g><circle cx="110" cy="56" r="28.5" fill="#4D78FF"/>`;
const createSvg = (x, y, width, height) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 120 120"><rect width="120" height="120" fill="#000000"/><svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="0 6 214 100">${mark}</svg></svg>`);

await mkdir(outputDirectory, { recursive: true });

for (const [filename, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  await sharp(createSvg(18, 41, 84, 39)).resize(size, size).png().toFile(path.join(outputDirectory, filename));
}

await sharp(createSvg(26, 43.5, 68, 32))
  .resize(512, 512)
  .png()
  .toFile(path.join(outputDirectory, 'icon-maskable-512.png'));

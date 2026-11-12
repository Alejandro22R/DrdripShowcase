import { randomBytes } from 'node:crypto';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { HttpError } from '../db/repo.js';

const MAX_SIDE = 800;
const RAW_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};
const VIDEO_TYPES: Record<string, string> = { 'video/mp4': '.mp4', 'video/webm': '.webm' };

/**
 * Stores an upload under data/media and returns its public URL.
 * Photos are shrunk to 800 px WebP so they never overload a TV. If sharp is
 * not available (for example inside the single-file .exe) the original file
 * is kept as is.
 */
export async function saveMedia(mediaDir: string, buffer: Buffer, mimetype: string): Promise<string> {
  mkdirSync(mediaDir, { recursive: true });
  const id = randomBytes(8).toString('hex');

  if (VIDEO_TYPES[mimetype]) {
    const name = `${id}${VIDEO_TYPES[mimetype]}`;
    writeFileSync(path.join(mediaDir, name), buffer);
    return `/media/${name}`;
  }
  if (!RAW_TYPES[mimetype]) throw new HttpError(400, 'Formato no admitido. Usa JPG, PNG, WebP, GIF, MP4 o WebM.');

  try {
    const sharp = (await import('sharp')).default;
    const name = `${id}.webp`;
    await sharp(buffer, { failOn: 'error' })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(mediaDir, name));
    return `/media/${name}`;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ERR_MODULE_NOT_FOUND' && !/Cannot find (module|package)|sharp-/.test(String(err)))
      throw new HttpError(400, 'No se pudo leer la imagen. Prueba con otro archivo.');
    const name = `${id}${RAW_TYPES[mimetype]}`;
    writeFileSync(path.join(mediaDir, name), buffer);
    return `/media/${name}`;
  }
}

export function deleteMedia(mediaDir: string, url: string): void {
  const name = path.basename(url);
  if (!url.startsWith('/media/') || !/^[0-9a-f]{16}\.[a-z0-9]+$/.test(name)) return;
  try {
    unlinkSync(path.join(mediaDir, name));
  } catch {
    /* already gone */
  }
}

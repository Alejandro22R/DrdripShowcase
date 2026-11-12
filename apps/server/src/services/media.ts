import { randomBytes } from 'node:crypto';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { isPackaged } from '../config.js';
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
    const sharp = await loadSharp();
    const name = `${id}.webp`;
    await sharp(buffer, { failOn: 'error' })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(mediaDir, name));
    return `/media/${name}`;
  } catch (err) {
    if (!(err instanceof SharpMissing)) throw new HttpError(400, 'No se pudo leer la imagen. Prueba con otro archivo.');
    const name = `${id}${RAW_TYPES[mimetype]}`;
    writeFileSync(path.join(mediaDir, name), buffer);
    return `/media/${name}`;
  }
}

class SharpMissing extends Error {}
type Sharp = typeof import('sharp').default;
let sharpModule: Sharp | null | undefined;

/**
 * sharp has native binaries, so it cannot live inside the single .exe. The
 * packaged program loads it from the node_modules folder that ships next to
 * the executable; in development it is a normal dependency.
 */
async function loadSharp(): Promise<Sharp> {
  if (sharpModule === undefined) {
    try {
      const require = createRequire(path.join(path.dirname(process.execPath), 'index.js'));
      sharpModule = isPackaged() ? (require('sharp') as Sharp) : (await import('sharp')).default;
    } catch {
      sharpModule = null;
    }
  }
  if (!sharpModule) throw new SharpMissing();
  return sharpModule;
}

/** Whether photos will be shrunk to WebP on this machine. */
export async function hasImageResizer(): Promise<boolean> {
  return loadSharp().then(() => true, () => false);
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

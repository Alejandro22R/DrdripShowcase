import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { clinicNow } from '@drdrip/shared';
import type { Db } from '../db/db.js';

export const KEEP_BACKUPS = 14;
const NAME = /^drdrip-\d{4}-\d{2}-\d{2}(-\d{6})?\.db$/;

export interface BackupInfo {
  name: string;
  size: number;
  created_at: string;
}

export function listBackups(dir: string): BackupInfo[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => NAME.test(name))
    .map((name) => {
      const stat = statSync(path.join(dir, name));
      return { name, size: stat.size, created_at: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.name.localeCompare(a.name));
}

export function isBackupName(name: string): boolean {
  return NAME.test(name);
}

/** Writes a consistent copy of the database and prunes old automatic copies. */
export function createBackup(db: Db, dir: string, opts: { manual?: boolean; now?: Date } = {}): BackupInfo {
  mkdirSync(dir, { recursive: true });
  const now = opts.now ?? new Date();
  const { ymd, minutes } = clinicNow(now);
  const hhmm = `${String(Math.trunc(minutes / 60)).padStart(2, '0')}${String(minutes % 60).padStart(2, '0')}`;
  const suffix = opts.manual ? `-${hhmm}${String(now.getUTCSeconds()).padStart(2, '0')}` : '';
  const name = `drdrip-${ymd}${suffix}.db`;
  const file = path.join(dir, name);
  if (existsSync(file)) unlinkSync(file);
  db.raw.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);

  const all = listBackups(dir);
  for (const old of all.slice(KEEP_BACKUPS)) unlinkSync(path.join(dir, old.name));
  const stat = statSync(file);
  return { name, size: stat.size, created_at: stat.mtime.toISOString() };
}

/** Creates today's backup if it does not exist yet. Safe to call often. */
export function ensureDailyBackup(db: Db, dir: string, now = new Date()): BackupInfo | null {
  const name = `drdrip-${clinicNow(now).ymd}.db`;
  if (existsSync(path.join(dir, name))) return null;
  return createBackup(db, dir, { now });
}

/** Checks every half hour; the first check after midnight (clinic time) makes the nightly copy. */
export function startBackupScheduler(db: Db, dir: string, onError: (err: unknown) => void): () => void {
  const tick = () => {
    try {
      ensureDailyBackup(db, dir);
    } catch (err) {
      onError(err);
    }
  };
  tick();
  const timer = setInterval(tick, 30 * 60_000);
  timer.unref();
  return () => clearInterval(timer);
}

import type { AppConfig } from './config.js';
import type { Db } from './db/db.js';
import { HttpError } from './db/repo.js';
import type { Auth } from './services/auth.js';
import type { Hub } from './services/hub.js';

export interface Ctx {
  db: Db;
  hub: Hub;
  auth: Auth;
  config: AppConfig;
  mediaDir: string;
  backupDir: string;
  logDir: string;
}

export function idParam(value: unknown): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'Identificador inválido.');
  return id;
}

export function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new HttpError(400, 'Se esperaba un objeto JSON.');
  return value as Record<string, unknown>;
}

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Db } from '../db/db.js';
import { HttpError } from '../db/repo.js';
import { getRaw, setRaw } from './settings.js';

export const FACTORY_PIN = '1234';
const PIN_KEY = 'pin_hash';
const SESSION_DAYS = 30;
const MAX_FAILURES = 5;
const LOCK_MS = 30_000;

function hashPin(pin: string, salt = randomBytes(16).toString('hex')): string {
  return `${salt}:${scryptSync(pin, salt, 32).toString('hex')}`;
}

function verify(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(pin, salt, 32);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export class Auth {
  private failures = new Map<string, { count: number; until: number }>();

  constructor(private db: Db) {
    if (!getRaw(db, PIN_KEY)) setRaw(db, PIN_KEY, hashPin(FACTORY_PIN));
    db.run(`DELETE FROM sessions WHERE created_at < datetime('now', '-${SESSION_DAYS} days')`);
  }

  private checkPin(pin: unknown): boolean {
    return typeof pin === 'string' && verify(pin, getRaw(this.db, PIN_KEY) ?? '');
  }

  isFactoryPin(): boolean {
    return this.checkPin(FACTORY_PIN);
  }

  login(pin: unknown, ip: string): string {
    const entry = this.failures.get(ip);
    if (entry && entry.until > Date.now())
      throw new HttpError(429, 'Demasiados intentos. Espera unos segundos e inténtalo de nuevo.');
    if (!this.checkPin(pin)) {
      const count = (entry?.count ?? 0) + 1;
      this.failures.set(ip, { count, until: count >= MAX_FAILURES ? Date.now() + LOCK_MS : 0 });
      throw new HttpError(401, 'PIN incorrecto.');
    }
    this.failures.delete(ip);
    const token = randomBytes(24).toString('hex');
    this.db.run('INSERT INTO sessions (token) VALUES (?)', token);
    return token;
  }

  logout(token: string): void {
    this.db.run('DELETE FROM sessions WHERE token = ?', token);
  }

  isValid(token: string | undefined): boolean {
    if (!token || !/^[0-9a-f]{48}$/.test(token)) return false;
    return this.db.get('SELECT 1 AS ok FROM sessions WHERE token = ?', token) !== undefined;
  }

  changePin(current: unknown, next: unknown, keepToken: string): void {
    if (!this.checkPin(current)) throw new HttpError(401, 'El PIN actual no es correcto.');
    if (typeof next !== 'string' || !/^\d{4,8}$/.test(next))
      throw new HttpError(400, 'El PIN nuevo debe tener entre 4 y 8 dígitos.');
    setRaw(this.db, PIN_KEY, hashPin(next));
    // Every other session must log in again with the new PIN.
    this.db.run('DELETE FROM sessions WHERE token <> ?', keepToken);
  }
}

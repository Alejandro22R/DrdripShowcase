import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { MIGRATIONS } from './schema.js';

// node:sqlite is built into Node, so the packaged .exe needs no native add-on.
// getBuiltinModule keeps bundlers and test runners from trying to resolve it.
const sqlite = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');

export type Row = Record<string, unknown>;
export type Param = SQLInputValue;

export class Db {
  readonly raw: DatabaseSync;
  private depth = 0;

  constructor(file: string) {
    this.raw = new sqlite.DatabaseSync(file);
    this.raw.exec('PRAGMA foreign_keys = ON');
    if (file !== ':memory:') {
      // WAL survives power cuts and lets readers work while a write happens.
      this.raw.exec('PRAGMA journal_mode = WAL');
      this.raw.exec('PRAGMA synchronous = NORMAL');
    }
    this.migrate();
  }

  private migrate(): void {
    const current = (this.get<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0) as number;
    for (let v = current; v < MIGRATIONS.length; v++) {
      this.tx(() => {
        this.raw.exec(MIGRATIONS[v]);
        this.raw.exec(`PRAGMA user_version = ${v + 1}`);
      });
    }
  }

  all<T = Row>(sql: string, ...params: Param[]): T[] {
    return this.raw.prepare(sql).all(...params) as T[];
  }

  get<T = Row>(sql: string, ...params: Param[]): T | undefined {
    return this.raw.prepare(sql).get(...params) as T | undefined;
  }

  run(sql: string, ...params: Param[]): { changes: number; id: number } {
    const result = this.raw.prepare(sql).run(...params);
    return { changes: Number(result.changes), id: Number(result.lastInsertRowid) };
  }

  /** Runs `fn` atomically. Nested calls join the outer transaction. */
  tx<T>(fn: () => T): T {
    if (this.depth > 0) return fn();
    this.raw.exec('BEGIN IMMEDIATE');
    this.depth++;
    try {
      const result = fn();
      this.raw.exec('COMMIT');
      return result;
    } catch (err) {
      this.raw.exec('ROLLBACK');
      throw err;
    } finally {
      this.depth--;
    }
  }

  close(): void {
    this.raw.close();
  }
}

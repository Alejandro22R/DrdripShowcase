import { appendFileSync, existsSync, mkdirSync, readdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const NAME = 'vitrina.log';
const LOG_FILE = /^vitrina(\.\d)?\.log$/;

/**
 * Small rotating log file. A Windows service has no console, so everything
 * the program prints also goes to data/logs/vitrina.log. Old files are kept
 * as vitrina.1.log … vitrina.N.log and the oldest is deleted, so logs can
 * never fill the disk.
 */
export class LogFile {
  private size = 0;
  readonly file: string;

  constructor(
    readonly dir: string,
    private maxBytes = 1024 * 1024,
    private keep = 5,
  ) {
    mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, NAME);
    this.size = existsSync(this.file) ? statSync(this.file).size : 0;
  }

  write(text: string): void {
    const line = text.endsWith('\n') ? text : `${text}\n`;
    try {
      if (this.size + line.length > this.maxBytes) this.rotate();
      appendFileSync(this.file, line);
      this.size += Buffer.byteLength(line);
    } catch {
      /* logging must never take the server down */
    }
  }

  private rotate(): void {
    const numbered = (n: number) => path.join(this.dir, `vitrina.${n}.log`);
    if (existsSync(numbered(this.keep))) unlinkSync(numbered(this.keep));
    for (let n = this.keep - 1; n >= 1; n--) {
      if (existsSync(numbered(n))) renameSync(numbered(n), numbered(n + 1));
    }
    if (existsSync(this.file)) renameSync(this.file, numbered(1));
    this.size = 0;
  }

  /** Sends console output to the file as well, with a timestamp. */
  captureConsole(): void {
    for (const level of ['log', 'warn', 'error'] as const) {
      const original = console[level].bind(console);
      console[level] = (...args: unknown[]) => {
        original(...args);
        const text = args.map((a) => (a instanceof Error ? (a.stack ?? a.message) : typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
        this.write(`${new Date().toISOString()} ${level.toUpperCase()} ${text}`);
      };
    }
  }
}

export function listLogs(dir: string): { name: string; size: number; modified_at: string }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => LOG_FILE.test(name))
    .map((name) => {
      const stat = statSync(path.join(dir, name));
      return { name, size: stat.size, modified_at: stat.mtime.toISOString() };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function isLogName(name: string): boolean {
  return LOG_FILE.test(name);
}

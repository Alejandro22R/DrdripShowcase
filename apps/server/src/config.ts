import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface AppConfig {
  port: number;
  host: string;
  /** Folder that contains apps/player and apps/admin/dist. */
  rootDir: string;
  /** Folder for the database, media, backups and logs. Kept outside the program files. */
  dataDir: string;
  mdns: boolean;
  mdnsName: string;
  /** Seed the catalog on first start. */
  seed: boolean;
  /** Use an in-memory database (tests). */
  memoryDb: boolean;
  logger: boolean;
  /** True when running as the packaged single executable (Node SEA). */
  packaged: boolean;
  /** How the program was started: Windows service, console window or development. */
  runMode: 'servicio' | 'consola' | 'desarrollo';
}

/** Minimal `key = value` parser for config.ini (comments with # or ;). */
export function parseIni(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';') || line.startsWith('[')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    out[line.slice(0, eq).trim().toLowerCase()] = line.slice(eq + 1).trim();
  }
  return out;
}

/** Walks up from `start` until it finds the folder that holds the player files. */
export function findRootDir(start: string): string {
  let dir = path.resolve(start);
  for (let i = 0; i < 6; i++) {
    if (existsSync(path.join(dir, 'apps', 'player', 'player.html'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(start);
}

/** True inside the packaged .exe. */
export function isPackaged(): boolean {
  try {
    const sea = process.getBuiltinModule('node:sea') as { isSea(): boolean } | undefined;
    return sea?.isSea() === true;
  } catch {
    return false;
  }
}

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const env = process.env;
  const packaged = isPackaged();
  // The packaged program always works from its own folder, whatever the
  // current directory is (a service starts in C:\\Windows\\System32).
  const rootDir = overrides.rootDir ?? env.DRDRIP_ROOT ?? (packaged ? path.dirname(process.execPath) : findRootDir(process.cwd()));
  const iniPath = path.join(rootDir, 'config.ini');
  const ini = existsSync(iniPath) ? parseIni(readFileSync(iniPath, 'utf8')) : {};

  const port = Number.parseInt(env.PORT ?? ini.port ?? '3000', 10);
  const dataDir = path.resolve(rootDir, env.DRDRIP_DATA_DIR ?? ini.data_dir ?? 'data');
  const flag = (value: string | undefined, fallback: boolean) =>
    value === undefined ? fallback : !['0', 'false', 'no', 'off'].includes(value.toLowerCase());

  return {
    port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 3000,
    host: env.HOST ?? ini.host ?? '0.0.0.0',
    rootDir,
    dataDir,
    mdns: flag(env.DRDRIP_MDNS ?? ini.mdns, true),
    mdnsName: env.DRDRIP_MDNS_NAME ?? ini.mdns_name ?? 'drdrip',
    seed: true,
    memoryDb: false,
    logger: true,
    packaged,
    runMode: process.argv.includes('--servicio') ? 'servicio' : packaged ? 'consola' : 'desarrollo',
    ...overrides,
  };
}

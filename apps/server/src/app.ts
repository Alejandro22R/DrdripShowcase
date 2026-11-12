import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import { loadConfig, type AppConfig } from './config.js';
import type { Ctx } from './context.js';
import { Db } from './db/db.js';
import { HttpError } from './db/repo.js';
import { isEmptyDb, seed } from './db/seed.js';
import { catalogRoutes } from './routes/catalog.js';
import { screenRoutes } from './routes/screens.js';
import { bearer, systemRoutes } from './routes/system.js';
import { Auth } from './services/auth.js';
import { Hub } from './services/hub.js';
import { LogFile } from './services/logfile.js';

const PUBLIC_API = ['/api/health', '/api/auth/login', '/api/devices/hello', '/api/public/'];

export interface BuiltApp {
  app: FastifyInstance;
  ctx: Ctx;
}

export async function buildApp(overrides: Partial<AppConfig> = {}): Promise<BuiltApp> {
  const config = loadConfig(overrides);
  const mediaDir = path.join(config.dataDir, 'media');
  const backupDir = path.join(config.dataDir, 'backups');
  if (!config.memoryDb) for (const dir of [config.dataDir, mediaDir, backupDir]) mkdirSync(dir, { recursive: true });

  const db = new Db(config.memoryDb ? ':memory:' : path.join(config.dataDir, 'drdrip.db'));
  if (config.seed && isEmptyDb(db)) seed(db);

  const logDir = path.join(config.dataDir, 'logs');
  const ctx: Ctx = { db, hub: new Hub(db), auth: new Auth(db), config, mediaDir, backupDir, logDir };

  // Outside development there may be no console (Windows service), so logs go to a rotating file.
  const logFile = config.logger && !config.memoryDb && config.runMode !== 'desarrollo' ? new LogFile(logDir) : null;
  logFile?.captureConsole();
  const app = Fastify({
    logger: config.logger
      ? { level: 'warn', ...(logFile ? { stream: { write: (line: string) => (process.stdout.write(line), logFile.write(line.trimEnd())) } } : {}) }
      : false,
    bodyLimit: 5 * 1024 * 1024,
  });

  app.setErrorHandler((err: unknown, _req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ error: err.message });
    const e = err as { statusCode?: number; code?: string; message?: string };
    if (e.code === 'FST_REQ_FILE_TOO_LARGE') return reply.code(413).send({ error: 'El archivo es demasiado grande (máximo 40 MB).' });
    if (e.statusCode && e.statusCode < 500) return reply.code(e.statusCode).send({ error: 'Solicitud inválida.' });
    if (/UNIQUE constraint/.test(e.message ?? '')) return reply.code(409).send({ error: 'Ya existe un registro con ese nombre.' });
    app.log.error(err);
    return reply.code(500).send({ error: 'Error interno del servidor.' });
  });

  await app.register(websocket, { options: { maxPayload: 4096 } });
  await app.register(multipart, { limits: { fileSize: 40 * 1024 * 1024, files: 1 } });
  app.addContentTypeParser(['text/csv', 'text/plain'], { parseAs: 'string' }, (_req, body, done) => done(null, body));

  // PIN gate: everything under /api needs a session except what players use.
  app.addHook('onRequest', async (req) => {
    const url = req.url.split('?')[0];
    if (!url.startsWith('/api/')) return;
    if (PUBLIC_API.some((prefix) => url === prefix || (prefix.endsWith('/') && url.startsWith(prefix)))) return;
    const query = req.query as { draft?: string; token?: string };
    if (url.startsWith('/api/player/') && query.draft !== '1') return;
    if (!ctx.auth.isValid(bearer(req.headers.authorization) ?? query.token)) throw new HttpError(401, 'Sesión no válida. Ingresa el PIN.');
  });

  app.get('/ws', { websocket: true }, (socket, req) => {
    ctx.hub.add(socket, req.ip, String(req.headers['user-agent'] ?? ''));
  });

  catalogRoutes(app, ctx);
  screenRoutes(app, ctx);
  systemRoutes(app, ctx);

  // --- Static files -----------------------------------------------------------
  const playerDir = path.join(config.rootDir, 'apps', 'player');
  const adminDir = path.join(config.rootDir, 'apps', 'admin', 'dist');
  const noStore = (reply: { header(name: string, value: string): unknown }) => void reply.header('Cache-Control', 'no-cache');

  await app.register(fastifyStatic, { root: playerDir, prefix: '/player/', setHeaders: noStore });
  if (!config.memoryDb) {
    await app.register(fastifyStatic, { root: mediaDir, prefix: '/media/', decorateReply: false, maxAge: '30d', immutable: true });
  }
  if (existsSync(adminDir)) {
    await app.register(fastifyStatic, { root: adminDir, prefix: '/admin/', decorateReply: false, setHeaders: noStore });
    app.get('/admin', (_req, reply) => reply.redirect('/admin/'));
  } else {
    app.get('/admin/', (_req, reply) =>
      reply.type('text/html; charset=utf-8').send('<p>El panel no está compilado. Ejecuta <code>npm run build</code>.</p>'),
    );
  }

  app.get('/', (_req, reply) => reply.sendFile('index.html'));
  // Short addresses for the TVs: /1, /2 …
  app.get<{ Params: { screen: string } }>('/:screen(^\\d{1,4}$)', (_req, reply) => reply.sendFile('player.html'));
  app.get('/favicon.ico', (_req, reply) => reply.sendFile('img/symbol.svg'));

  app.addHook('onClose', async () => {
    ctx.hub.closeAll();
    db.close();
  });

  return { app, ctx };
}

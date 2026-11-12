import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import { APP_VERSION, CLINIC_TIMEZONE } from '@drdrip/shared';
import type { FastifyInstance } from 'fastify';
import { asObject, idParam, type Ctx } from '../context.js';
import { HttpError, SPECS, deleteRow, getRow, patchRow } from '../db/repo.js';
import { createBackup, isBackupName, listBackups } from '../services/backup.js';
import { saveMedia } from '../services/media.js';
import { lanAddresses } from '../services/network.js';
import { getSettings, patchSettings } from '../services/settings.js';

const DEVICE_ID = /^[A-Za-z0-9_-]{8,64}$/;

export function bearer(header: string | undefined): string | undefined {
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}

export function systemRoutes(app: FastifyInstance, ctx: Ctx): void {
  const { db, hub, auth, config } = ctx;

  app.get('/api/health', () => ({ ok: true, version: APP_VERSION }));

  // --- Access ---------------------------------------------------------------

  app.post('/api/auth/login', (req) => {
    const token = auth.login((req.body as { pin?: unknown } | null)?.pin, req.ip);
    return { token, factory_pin: auth.isFactoryPin() };
  });

  app.post('/api/auth/logout', (req, reply) => {
    auth.logout(bearer(req.headers.authorization) ?? '');
    return reply.code(204).send();
  });

  app.post('/api/system/pin', (req, reply) => {
    const body = asObject(req.body);
    auth.changePin(body.current, body.next, bearer(req.headers.authorization) ?? '');
    return reply.code(204).send();
  });

  // --- Settings (brand, contact, hours) ------------------------------------

  app.get('/api/settings', () => getSettings(db));

  app.patch('/api/settings', (req) => {
    const settings = patchSettings(db, req.body);
    hub.notifyUpdate();
    return settings;
  });

  // --- Uploads --------------------------------------------------------------

  app.post('/api/media', async (req, reply) => {
    const file = await req.file();
    if (!file) throw new HttpError(400, 'No se recibió ningún archivo.');
    const buffer = await file.toBuffer();
    return reply.code(201).send({ url: await saveMedia(ctx.mediaDir, buffer, file.mimetype) });
  });

  // --- Devices: assisted registration of TVs --------------------------------

  app.post('/api/devices/hello', (req) => {
    const deviceId = (req.body as { deviceId?: unknown } | null)?.deviceId;
    if (typeof deviceId !== 'string' || !DEVICE_ID.test(deviceId)) throw new HttpError(400, 'Identificador de dispositivo inválido.');
    return { screen_id: hub.touchDevice(deviceId, req.ip, String(req.headers['user-agent'] ?? '')) };
  });

  app.get('/api/devices', () => {
    const online = hub.online();
    return db.all<{ id: string }>('SELECT * FROM devices ORDER BY last_seen DESC').map((device) => {
      const live = online.find((c) => c.deviceId === device.id);
      return { ...device, online: live !== undefined, showing_screen_id: live?.screenId ?? null };
    });
  });

  app.patch<{ Params: { id: string } }>('/api/devices/:id', (req) => {
    const body = asObject(req.body);
    if (typeof body.screen_id === 'number') getRow(db, SPECS.screens, idParam(body.screen_id));
    const row = patchRow<{ id: string; screen_id: number | null }>(db, SPECS.devices, req.params.id, body);
    if (body.screen_id !== undefined && row.screen_id !== null) hub.sendToDevice(row.id, { type: 'assign', screenId: row.screen_id });
    return row;
  });

  app.delete<{ Params: { id: string } }>('/api/devices/:id', (req, reply) => {
    deleteRow(db, SPECS.devices, req.params.id);
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>('/api/devices/:id/reload', (req) => ({
    sent: hub.sendToDevice(req.params.id, { type: 'reload' }),
  }));

  // --- System ---------------------------------------------------------------

  app.get('/api/system/status', () => {
    const addresses = lanAddresses();
    const count = (table: string) => db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)?.n ?? 0;
    let dbSize = 0;
    try {
      dbSize = statSync(path.join(config.dataDir, 'drdrip.db')).size;
    } catch {
      /* in-memory database */
    }
    return {
      version: APP_VERSION,
      uptime_s: Math.round(process.uptime()),
      timezone: CLINIC_TIMEZONE,
      server_time: new Date().toISOString(),
      port: config.port,
      addresses,
      urls: [...addresses.map((a) => `http://${a.address}:${config.port}`), ...(config.mdns ? [`http://${config.mdnsName}.local:${config.port}`] : [])],
      factory_pin: auth.isFactoryPin(),
      db_size: dbSize,
      backups: listBackups(ctx.backupDir),
      online: hub.online(),
      counts: {
        services: count('services'),
        hidden_services: db.get<{ n: number }>('SELECT COUNT(*) AS n FROM services WHERE visible = 0')?.n ?? 0,
        addons: count('addons'),
        screens: count('screens'),
        devices: count('devices'),
        unassigned_devices: db.get<{ n: number }>('SELECT COUNT(*) AS n FROM devices WHERE screen_id IS NULL')?.n ?? 0,
      },
    };
  });

  app.post('/api/system/backup', () => createBackup(db, ctx.backupDir, { manual: true }));

  app.get<{ Params: { name: string } }>('/api/system/backups/:name', (req, reply) => {
    const { name } = req.params;
    if (!isBackupName(name) || !listBackups(ctx.backupDir).some((b) => b.name === name))
      throw new HttpError(404, 'No se encontró el respaldo.');
    return reply
      .header('Content-Type', 'application/octet-stream')
      .header('Content-Disposition', `attachment; filename="${name}"`)
      .send(createReadStream(path.join(ctx.backupDir, name)));
  });

  app.post('/api/system/reload-screens', () => {
    const online = hub.online();
    for (const client of online) hub.sendToDevice(client.deviceId, { type: 'reload' });
    return { sent: online.length };
  });
}

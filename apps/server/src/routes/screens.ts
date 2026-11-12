import { THEMES, TRANSITIONS, getTemplate, type Theme, type Transition } from '@drdrip/shared';
import type { FastifyInstance } from 'fastify';
import { asObject, idParam, type Ctx } from '../context.js';
import { HttpError, SPECS, deleteRow, getRow, insertRow, listRows, patchRow } from '../db/repo.js';
import {
  applySnapshot,
  buildPlayerPayload,
  duplicateScreen,
  hasUnpublishedChanges,
  listVersions,
  publishScreen,
  restoreVersion,
} from '../services/publisher.js';

function validateScreen(body: Record<string, unknown>): void {
  if (body.orientation !== undefined && !['landscape', 'portrait'].includes(body.orientation as string))
    throw new HttpError(400, 'Orientación inválida.');
  if (body.theme !== undefined && !THEMES.includes(body.theme as Theme)) throw new HttpError(400, 'Tema inválido.');
  if (body.resolution !== undefined && !['720p', '1080p', '4k'].includes(body.resolution as string))
    throw new HttpError(400, 'Resolución inválida.');
}

function validateSlide(body: Record<string, unknown>): void {
  if (body.template !== undefined && !getTemplate(String(body.template))) throw new HttpError(400, 'Plantilla desconocida.');
  if (body.theme !== undefined && body.theme !== '' && !THEMES.includes(body.theme as Theme)) throw new HttpError(400, 'Tema inválido.');
  if (body.transition !== undefined && !TRANSITIONS.includes(body.transition as Transition))
    throw new HttpError(400, 'Transición inválida.');
  if (body.duration_s !== undefined && !(Number.isInteger(body.duration_s) && (body.duration_s as number) >= 3 && (body.duration_s as number) <= 600))
    throw new HttpError(400, 'La duración debe estar entre 3 y 600 segundos.');
  for (const key of ['config_json', 'schedule_json']) {
    if (body[key] !== undefined) asObject(body[key]);
  }
}

export function screenRoutes(app: FastifyInstance, ctx: Ctx): void {
  const { db, hub } = ctx;

  const describe = (screen: { id: number }) => {
    const online = hub.online().filter((c) => c.screenId === screen.id).length;
    const slides = db.get<{ n: number }>('SELECT COUNT(*) AS n FROM slides WHERE screen_id = ?', screen.id)?.n ?? 0;
    const last = db.get<{ published_at: string }>(
      'SELECT published_at FROM config_versions WHERE screen_id = ? ORDER BY id DESC LIMIT 1',
      screen.id,
    );
    return { ...screen, slides, online, dirty: hasUnpublishedChanges(db, screen.id), published_at: last?.published_at ?? null };
  };

  app.get('/api/screens', () => listRows<{ id: number }>(db, SPECS.screens).map(describe));

  app.post('/api/screens', (req, reply) => {
    const body = asObject(req.body);
    validateScreen(body);
    return reply.code(201).send(describe(insertRow<{ id: number }>(db, SPECS.screens, body)));
  });

  app.patch<{ Params: { id: string } }>('/api/screens/:id', (req) => {
    const id = idParam(req.params.id);
    const body = asObject(req.body);
    validateScreen(body);
    const row = patchRow<{ id: number }>(db, SPECS.screens, id, body);
    // Name and active are live properties; everything else waits for Publish.
    if (body.active !== undefined || body.name !== undefined) hub.notifyUpdate(id);
    return describe(row);
  });

  app.delete<{ Params: { id: string } }>('/api/screens/:id', (req, reply) => {
    const id = idParam(req.params.id);
    deleteRow(db, SPECS.screens, id);
    hub.notifyUpdate(id);
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>('/api/screens/:id/duplicate', (req, reply) => {
    const body = (req.body ?? {}) as { name?: string };
    const newId = duplicateScreen(db, idParam(req.params.id), typeof body.name === 'string' ? body.name : undefined);
    return reply.code(201).send(describe(getRow<{ id: number }>(db, SPECS.screens, newId)));
  });

  // --- Slides (draft) -------------------------------------------------------

  app.get<{ Params: { id: string } }>('/api/screens/:id/slides', (req) => {
    const id = idParam(req.params.id);
    getRow(db, SPECS.screens, id);
    return listRows(db, SPECS.slides, 'screen_id = ?', id);
  });

  app.post<{ Params: { id: string } }>('/api/screens/:id/slides', (req, reply) => {
    const screenId = idParam(req.params.id);
    getRow(db, SPECS.screens, screenId);
    const body = asObject(req.body);
    validateSlide(body);
    const template = getTemplate(String(body.template ?? ''));
    if (!template) throw new HttpError(400, 'Falta la plantilla.');
    const next = db.get<{ p: number }>('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM slides WHERE screen_id = ?', screenId)!.p;
    const row = insertRow(db, SPECS.slides, { config_json: template.defaults, ...body, position: next }, { screen_id: screenId });
    return reply.code(201).send(row);
  });

  app.patch<{ Params: { id: string } }>('/api/slides/:id', (req) => {
    const body = asObject(req.body);
    validateSlide(body);
    return patchRow(db, SPECS.slides, idParam(req.params.id), body);
  });

  app.delete<{ Params: { id: string } }>('/api/slides/:id', (req, reply) => {
    deleteRow(db, SPECS.slides, idParam(req.params.id));
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>('/api/slides/:id/duplicate', (req, reply) => {
    const source = db.get<Record<string, string | number>>('SELECT * FROM slides WHERE id = ?', idParam(req.params.id));
    if (!source) throw new HttpError(404, 'No se encontró la diapositiva.');
    const { id } = db.tx(() => {
      db.run('UPDATE slides SET position = position + 1 WHERE screen_id = ? AND position > ?', source.screen_id, source.position);
      return db.run(
        `INSERT INTO slides (screen_id, template, config_json, theme, duration_s, transition, schedule_json, position, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        source.screen_id, source.template, source.config_json, source.theme, source.duration_s,
        source.transition, source.schedule_json, Number(source.position) + 1, source.active,
      );
    });
    return reply.code(201).send(getRow(db, SPECS.slides, id));
  });

  app.post<{ Params: { id: string } }>('/api/screens/:id/slides/reorder', (req) => {
    const screenId = idParam(req.params.id);
    const ids = asObject(req.body).ids;
    const current = db.all<{ id: number }>('SELECT id FROM slides WHERE screen_id = ?', screenId).map((r) => r.id);
    if (!Array.isArray(ids) || ids.length !== current.length || !current.every((id) => ids.includes(id)))
      throw new HttpError(400, 'La lista debe incluir todas las diapositivas de la pantalla, una sola vez.');
    db.tx(() => ids.forEach((id, position) => db.run('UPDATE slides SET position = ? WHERE id = ?', position, id as number)));
    return listRows(db, SPECS.slides, 'screen_id = ?', screenId);
  });

  // --- Publishing and versions ---------------------------------------------

  app.post<{ Params: { id: string } }>('/api/screens/:id/publish', (req) => {
    const id = idParam(req.params.id);
    const note = (req.body as { note?: unknown } | null)?.note;
    const version = publishScreen(db, id, typeof note === 'string' ? note : '');
    hub.notifyUpdate(id);
    return version;
  });

  /** Throws the draft away and goes back to what is on the screens. */
  app.post<{ Params: { id: string } }>('/api/screens/:id/discard', (req) => {
    const id = idParam(req.params.id);
    const latest = db.get<{ id: number }>('SELECT id FROM config_versions WHERE screen_id = ? ORDER BY id DESC LIMIT 1', id);
    if (!latest) throw new HttpError(409, 'Esta pantalla todavía no se ha publicado.');
    const snapshot = db.get<{ snapshot_json: string }>('SELECT snapshot_json FROM config_versions WHERE id = ?', latest.id)!;
    applySnapshot(db, id, JSON.parse(snapshot.snapshot_json));
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>('/api/screens/:id/versions', (req) => listVersions(db, idParam(req.params.id)));

  app.post<{ Params: { id: string } }>('/api/versions/:id/restore', (req) => {
    const result = restoreVersion(db, idParam(req.params.id));
    hub.notifyUpdate(result.screenId);
    return result;
  });

  // --- Public endpoints used by the player ---------------------------------

  app.get('/api/public/screens', () =>
    listRows<{ id: number; name: string; active: boolean }>(db, SPECS.screens)
      .filter((s) => s.active)
      .map((s) => ({ id: s.id, name: s.name })),
  );

  app.get<{ Params: { id: string }; Querystring: { draft?: string } }>('/api/player/:id', (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    // Draft access is checked by the auth hook (see app.ts).
    return buildPlayerPayload(db, idParam(req.params.id), { draft: req.query.draft === '1' });
  });
}

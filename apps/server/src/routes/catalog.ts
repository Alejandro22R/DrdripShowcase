import { PRICE_MODES, adjustCents, isValidCents, type PriceMode } from '@drdrip/shared';
import type { FastifyInstance } from 'fastify';
import { asObject, idParam, type Ctx } from '../context.js';
import { HttpError, SPECS, deleteRow, getRow, insertRow, listRows, patchRow, slugify, type TableSpec } from '../db/repo.js';
import { exportServicesCsv, importServicesCsv } from '../services/csv.js';
import { deleteMedia } from '../services/media.js';

interface ServiceRow {
  id: number;
  price_cents: number;
  price_mode: PriceMode;
  image_path: string;
  offer_cents: number;
}

/** Thrown inside the transaction, so an invalid offer is never stored. */
function assertOfferBelowPrice(row: ServiceRow): void {
  if (row.offer_cents > 0 && row.price_mode !== 'ask' && row.offer_cents >= row.price_cents)
    throw new HttpError(400, 'El precio de oferta debe ser menor que el precio normal.');
}

const YMD = /^(\d{4}-\d{2}-\d{2})?$/;

function validateService(body: Record<string, unknown>): void {
  if (body.price_cents !== undefined && !isValidCents(body.price_cents))
    throw new HttpError(400, 'El precio debe ser un número entero de centavos, sin negativos.');
  if (body.price_mode !== undefined && !PRICE_MODES.includes(body.price_mode as PriceMode))
    throw new HttpError(400, 'Modo de precio inválido. Usa fixed, from o ask.');
  if (body.duration_min !== undefined && !(Number.isInteger(body.duration_min) && (body.duration_min as number) >= 0 && (body.duration_min as number) <= 1440))
    throw new HttpError(400, 'La duración debe estar entre 0 y 1440 minutos.');
  if (body.offer_cents !== undefined && !isValidCents(body.offer_cents))
    throw new HttpError(400, 'El precio de oferta debe ser un número entero de centavos, sin negativos.');
  if (body.offer_ends_at !== undefined && (typeof body.offer_ends_at !== 'string' || !YMD.test(body.offer_ends_at)))
    throw new HttpError(400, 'La fecha de fin de la oferta debe tener el formato AAAA-MM-DD.');
  if (body.benefits !== undefined && !(Array.isArray(body.benefits) && body.benefits.every((b) => typeof b === 'string')))
    throw new HttpError(400, 'Los beneficios deben ser una lista de textos.');
}

export function catalogRoutes(app: FastifyInstance, ctx: Ctx): void {
  const { db, hub } = ctx;
  const changed = () => hub.notifyUpdate();

  /** Registers list/create/patch/delete for a simple table. */
  function crud(pathName: string, spec: TableSpec, validate: (body: Record<string, unknown>, creating: boolean) => void): void {
    app.get(`/api/${pathName}`, () => listRows(db, spec));
    app.post(`/api/${pathName}`, (req, reply) => {
      const body = asObject(req.body);
      validate(body, true);
      const row = insertRow(db, spec, body);
      changed();
      return reply.code(201).send(row);
    });
    app.patch<{ Params: { id: string } }>(`/api/${pathName}/:id`, (req) => {
      const body = asObject(req.body);
      validate(body, false);
      const row = patchRow(db, spec, idParam(req.params.id), body);
      changed();
      return row;
    });
    app.delete<{ Params: { id: string } }>(`/api/${pathName}/:id`, (req, reply) => {
      const id = idParam(req.params.id);
      const before = getRow<{ image_path?: string }>(db, spec, id);
      deleteRow(db, spec, id);
      if (before.image_path) deleteMedia(ctx.mediaDir, before.image_path);
      changed();
      return reply.code(204).send();
    });
  }

  crud('categories', SPECS.categories, (body, creating) => {
    if (creating && typeof body.name === 'string' && !body.slug) {
      let slug = slugify(body.name);
      if (db.get('SELECT 1 AS x FROM categories WHERE slug = ?', slug)) slug = `${slug}-${Date.now() % 100000}`;
      body.slug = slug;
    }
  });

  crud('addons', SPECS.addons, (body) => {
    if (body.price_cents !== undefined && !isValidCents(body.price_cents))
      throw new HttpError(400, 'El precio debe ser un número entero de centavos, sin negativos.');
  });

  crud('promos', SPECS.promos, (body) => {
    for (const key of ['starts_at', 'ends_at']) {
      if (body[key] !== undefined && (typeof body[key] !== 'string' || !YMD.test(body[key] as string)))
        throw new HttpError(400, 'Las fechas deben tener el formato AAAA-MM-DD.');
    }
  });

  // --- Services: same CRUD plus price history -----------------------------

  app.get('/api/services', () => listRows(db, SPECS.services));

  app.post('/api/services', (req, reply) => {
    const body = asObject(req.body);
    validateService(body);
    const row = db.tx(() => {
      const created = insertRow<ServiceRow>(db, SPECS.services, body);
      assertOfferBelowPrice(created);
      return created;
    });
    changed();
    return reply.code(201).send(row);
  });

  app.patch<{ Params: { id: string } }>('/api/services/:id', (req) => {
    const id = idParam(req.params.id);
    const body = asObject(req.body);
    validateService(body);
    const row = db.tx(() => {
      const before = getRow<ServiceRow>(db, SPECS.services, id);
      const after = patchRow<ServiceRow>(db, SPECS.services, id, body, { updated_at: new Date().toISOString().slice(0, 19).replace('T', ' ') });
      assertOfferBelowPrice(after);
      if (before.price_cents !== after.price_cents || before.price_mode !== after.price_mode) {
        db.run(
          'INSERT INTO price_history (service_id, old_cents, new_cents, old_mode, new_mode) VALUES (?, ?, ?, ?, ?)',
          id,
          before.price_cents,
          after.price_cents,
          before.price_mode,
          after.price_mode,
        );
      }
      if (before.image_path && before.image_path !== after.image_path) deleteMedia(ctx.mediaDir, before.image_path);
      return after;
    });
    changed();
    return row;
  });

  app.delete<{ Params: { id: string } }>('/api/services/:id', (req, reply) => {
    const id = idParam(req.params.id);
    const before = getRow<ServiceRow>(db, SPECS.services, id);
    deleteRow(db, SPECS.services, id);
    if (before.image_path) deleteMedia(ctx.mediaDir, before.image_path);
    changed();
    return reply.code(204).send();
  });

  app.get<{ Querystring: { service_id?: string } }>('/api/price-history', (req) => {
    const filter = req.query.service_id ? idParam(req.query.service_id) : null;
    return db.all(
      `SELECT h.*, s.name AS service_name FROM price_history h JOIN services s ON s.id = h.service_id
       ${filter ? 'WHERE h.service_id = ?' : ''} ORDER BY h.id DESC LIMIT 200`,
      ...(filter ? [filter] : []),
    );
  });

  /** Bulk change by percentage (basis points), optionally limited to one category. */
  app.post('/api/services/bulk-adjust', (req) => {
    const body = asObject(req.body);
    const bp = body.basis_points;
    if (typeof bp !== 'number' || !Number.isInteger(bp) || bp === 0 || bp < -9000 || bp > 50000)
      throw new HttpError(400, 'El porcentaje debe estar entre -90 % y 500 %, y no puede ser 0.');
    const categoryId = body.category_id === undefined || body.category_id === null ? null : idParam(body.category_id);
    const roundToDollar = body.round_to_dollar === true;

    const updated = db.tx(() => {
      const rows = db.all<ServiceRow>(
        `SELECT id, price_cents, price_mode FROM services WHERE price_mode <> 'ask' AND price_cents > 0
         ${categoryId ? 'AND category_id = ?' : ''}`,
        ...(categoryId ? [categoryId] : []),
      );
      let count = 0;
      for (const row of rows) {
        const next = adjustCents(row.price_cents, bp, roundToDollar);
        if (next === row.price_cents) continue;
        db.run(`UPDATE services SET price_cents = ?, updated_at = datetime('now') WHERE id = ?`, next, row.id);
        db.run(
          'INSERT INTO price_history (service_id, old_cents, new_cents, old_mode, new_mode) VALUES (?, ?, ?, ?, ?)',
          row.id,
          row.price_cents,
          next,
          row.price_mode,
          row.price_mode,
        );
        count++;
      }
      return count;
    });
    if (updated) changed();
    return { updated };
  });

  app.get('/api/services/export.csv', (_req, reply) =>
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="drdrip-servicios.csv"')
      .send(exportServicesCsv(db)),
  );

  app.post('/api/services/import', (req) => {
    if (typeof req.body !== 'string') throw new HttpError(400, 'Envía el archivo CSV como texto.');
    const result = importServicesCsv(db, req.body);
    changed();
    return result;
  });
}

import { PRICE_MODES, centsToInput, parsePriceInput, type PriceMode } from '@drdrip/shared';
import type { Db } from '../db/db.js';
import { HttpError, slugify } from '../db/repo.js';

const HEADERS = ['id', 'nombre', 'categoria', 'precio', 'modo', 'duracion_min', 'descripcion', 'etiqueta', 'visible', 'disponible'];

function cell(value: unknown): string {
  const text = String(value ?? '');
  return /[",;\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportServicesCsv(db: Db): string {
  const rows = db.all<Record<string, unknown>>(
    `SELECT s.*, c.name AS category FROM services s LEFT JOIN categories c ON c.id = s.category_id
     ORDER BY c.sort_order, s.sort_order, s.id`,
  );
  const lines = rows.map((r) =>
    [
      r.id,
      r.name,
      r.category ?? '',
      centsToInput(r.price_cents as number),
      r.price_mode,
      r.duration_min,
      r.description,
      r.badge,
      r.visible ? 'si' : 'no',
      r.available ? 'si' : 'no',
    ]
      .map(cell)
      .join(','),
  );
  // BOM so Excel opens accents correctly.
  return `﻿${HEADERS.join(',')}\r\n${lines.join('\r\n')}\r\n`;
}

/** RFC 4180 parser: quoted cells, doubled quotes and line breaks inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',' || ch === ';') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

const truthy = (v: string) => ['si', 'sí', 'yes', '1', 'true', 'x'].includes(v.trim().toLowerCase());

export interface ImportResult {
  created: number;
  updated: number;
  price_changes: number;
}

/**
 * Imports services. Rows match by `id`, otherwise by exact name. Only the
 * columns present in the file are written, so a partial sheet is safe. Any
 * invalid row aborts the whole import.
 */
export function importServicesCsv(db: Db, text: string): ImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new HttpError(400, 'El archivo no tiene filas para importar.');
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  if (col('nombre') < 0) throw new HttpError(400, 'Falta la columna "nombre".');

  const result: ImportResult = { created: 0, updated: 0, price_changes: 0 };
  db.tx(() => {
    rows.slice(1).forEach((cells, index) => {
      const line = index + 2;
      const get = (name: string): string | undefined => (col(name) >= 0 ? (cells[col(name)] ?? '').trim() : undefined);
      const name = get('nombre');
      if (!name) throw new HttpError(400, `Fila ${line}: falta el nombre.`);

      const set: Record<string, string | number | null> = { name };
      const price = get('precio');
      if (price !== undefined && price !== '') {
        const cents = parsePriceInput(price);
        if (cents === null) throw new HttpError(400, `Fila ${line}: precio inválido "${price}".`);
        set.price_cents = cents;
      }
      const mode = get('modo');
      if (mode !== undefined && mode !== '') {
        if (!PRICE_MODES.includes(mode as PriceMode)) throw new HttpError(400, `Fila ${line}: modo inválido "${mode}".`);
        set.price_mode = mode;
      }
      const duration = get('duracion_min');
      if (duration !== undefined && duration !== '') {
        if (!/^\d{1,4}$/.test(duration)) throw new HttpError(400, `Fila ${line}: duración inválida "${duration}".`);
        set.duration_min = Number.parseInt(duration, 10);
      }
      const category = get('categoria');
      if (category !== undefined) {
        if (category === '') set.category_id = null;
        else {
          const found = db.get<{ id: number }>('SELECT id FROM categories WHERE name = ? COLLATE NOCASE', category);
          set.category_id =
            found?.id ??
            db.run('INSERT INTO categories (name, slug, sort_order) VALUES (?, ?, 99)', category, `${slugify(category)}-${Date.now() % 100000}`).id;
        }
      }
      const description = get('descripcion');
      if (description !== undefined) set.description = description;
      const badge = get('etiqueta');
      if (badge !== undefined) set.badge = badge;
      const visible = get('visible');
      if (visible !== undefined && visible !== '') set.visible = truthy(visible) ? 1 : 0;
      const available = get('disponible');
      if (available !== undefined && available !== '') set.available = truthy(available) ? 1 : 0;

      const idText = get('id');
      const existing =
        (idText && /^\d+$/.test(idText)
          ? db.get<{ id: number; price_cents: number; price_mode: string }>('SELECT id, price_cents, price_mode FROM services WHERE id = ?', Number(idText))
          : undefined) ??
        db.get<{ id: number; price_cents: number; price_mode: string }>(
          'SELECT id, price_cents, price_mode FROM services WHERE name = ? COLLATE NOCASE',
          name,
        );

      const names = Object.keys(set);
      if (existing) {
        db.run(
          `UPDATE services SET ${names.map((n) => `${n} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`,
          ...Object.values(set),
          existing.id,
        );
        const newCents = (set.price_cents as number | undefined) ?? existing.price_cents;
        const newMode = (set.price_mode as string | undefined) ?? existing.price_mode;
        if (newCents !== existing.price_cents || newMode !== existing.price_mode) {
          db.run(
            'INSERT INTO price_history (service_id, old_cents, new_cents, old_mode, new_mode) VALUES (?, ?, ?, ?, ?)',
            existing.id,
            existing.price_cents,
            newCents,
            existing.price_mode,
            newMode,
          );
          result.price_changes++;
        }
        result.updated++;
      } else {
        db.run(`INSERT INTO services (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`, ...Object.values(set));
        result.created++;
      }
    });
  });
  return result;
}

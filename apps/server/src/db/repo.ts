import type { Db, Param, Row } from './db.js';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type FieldType = 'text' | 'int' | 'bool' | 'json' | 'ref';

export interface TableSpec {
  table: string;
  /** Editable columns. `id` is implicit and never editable. */
  fields: Record<string, FieldType>;
  /** Columns that must be present (and non-empty) when creating. */
  required: string[];
  orderBy: string;
}

function encode(field: string, type: FieldType, value: unknown): Param {
  switch (type) {
    case 'text':
      if (typeof value !== 'string') throw new HttpError(400, `El campo "${field}" debe ser texto.`);
      return value.trim();
    case 'int':
      if (typeof value !== 'number' || !Number.isInteger(value))
        throw new HttpError(400, `El campo "${field}" debe ser un número entero.`);
      return value;
    case 'ref':
      if (value === null) return null;
      if (typeof value !== 'number' || !Number.isInteger(value))
        throw new HttpError(400, `El campo "${field}" debe ser un identificador o null.`);
      return value;
    case 'bool':
      if (typeof value !== 'boolean') throw new HttpError(400, `El campo "${field}" debe ser verdadero o falso.`);
      return value ? 1 : 0;
    case 'json':
      if (value === undefined || value === null) throw new HttpError(400, `El campo "${field}" es inválido.`);
      return JSON.stringify(value);
  }
}

function decode(type: FieldType, value: unknown): unknown {
  if (type === 'bool') return value === 1;
  if (type === 'json') {
    try {
      return JSON.parse(String(value));
    } catch {
      return null;
    }
  }
  return value;
}

export function fromRow<T = Row>(spec: TableSpec, row: Row): T {
  const out: Row = { ...row };
  for (const [field, type] of Object.entries(spec.fields)) {
    if (field in row) out[field] = decode(type, row[field]);
  }
  return out as T;
}

/**
 * Converts request input to column values. Only keys that were actually sent
 * are returned, so a PATCH never touches the columns it did not mention.
 */
export function toColumns(spec: TableSpec, input: unknown): Record<string, Param> {
  if (typeof input !== 'object' || input === null || Array.isArray(input))
    throw new HttpError(400, 'Se esperaba un objeto JSON.');
  const out: Record<string, Param> = {};
  for (const [field, type] of Object.entries(spec.fields)) {
    const value = (input as Row)[field];
    if (value === undefined) continue;
    out[field] = encode(field, type, value);
  }
  return out;
}

export function listRows<T = Row>(db: Db, spec: TableSpec, where = '', ...params: Param[]): T[] {
  const sql = `SELECT * FROM ${spec.table} ${where ? `WHERE ${where}` : ''} ORDER BY ${spec.orderBy}`;
  return db.all(sql, ...params).map((row) => fromRow<T>(spec, row));
}

export function getRow<T = Row>(db: Db, spec: TableSpec, id: number | string): T {
  const row = db.get(`SELECT * FROM ${spec.table} WHERE id = ?`, id);
  if (!row) throw new HttpError(404, 'No se encontró el registro.');
  return fromRow<T>(spec, row);
}

export function insertRow<T = Row>(db: Db, spec: TableSpec, input: unknown, extra: Record<string, Param> = {}): T {
  const cols = { ...toColumns(spec, input), ...extra };
  for (const field of spec.required) {
    if (cols[field] === undefined || cols[field] === '') throw new HttpError(400, `Falta el campo "${field}".`);
  }
  const names = Object.keys(cols);
  const sql = names.length
    ? `INSERT INTO ${spec.table} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`
    : `INSERT INTO ${spec.table} DEFAULT VALUES`;
  const { id } = db.run(sql, ...Object.values(cols));
  return getRow<T>(db, spec, id);
}

export function patchRow<T = Row>(
  db: Db,
  spec: TableSpec,
  id: number | string,
  input: unknown,
  extra: Record<string, Param> = {},
): T {
  getRow(db, spec, id); // 404 when missing
  const cols = { ...toColumns(spec, input), ...extra };
  for (const field of spec.required) {
    if (cols[field] === '') throw new HttpError(400, `El campo "${field}" no puede quedar vacío.`);
  }
  const names = Object.keys(cols);
  if (names.length) {
    db.run(
      `UPDATE ${spec.table} SET ${names.map((n) => `${n} = ?`).join(', ')} WHERE id = ?`,
      ...Object.values(cols),
      id,
    );
  }
  return getRow<T>(db, spec, id);
}

export function deleteRow(db: Db, spec: TableSpec, id: number | string): void {
  const { changes } = db.run(`DELETE FROM ${spec.table} WHERE id = ?`, id);
  if (!changes) throw new HttpError(404, 'No se encontró el registro.');
}

export const SPECS = {
  categories: {
    table: 'categories',
    fields: { name: 'text', slug: 'text', icon: 'text', sort_order: 'int', active: 'bool' },
    required: ['name', 'slug'],
    orderBy: 'sort_order, id',
  },
  services: {
    table: 'services',
    fields: {
      name: 'text',
      name_en: 'text',
      description: 'text',
      benefits: 'json',
      category_id: 'ref',
      price_cents: 'int',
      price_mode: 'text',
      duration_min: 'int',
      image_path: 'text',
      badge: 'text',
      is_featured: 'bool',
      available: 'bool',
      visible: 'bool',
      sort_order: 'int',
      offer_cents: 'int',
      offer_label: 'text',
      offer_ends_at: 'text',
    },
    required: ['name'],
    orderBy: 'sort_order, id',
  },
  addons: {
    table: 'addons',
    fields: { name: 'text', price_cents: 'int', description: 'text', sort_order: 'int', active: 'bool' },
    required: ['name'],
    orderBy: 'sort_order, id',
  },
  promos: {
    table: 'promos',
    fields: {
      title: 'text',
      subtitle: 'text',
      image_path: 'text',
      starts_at: 'text',
      ends_at: 'text',
      active: 'bool',
    },
    required: ['title'],
    orderBy: 'id DESC',
  },
  screens: {
    table: 'screens',
    fields: {
      name: 'text',
      orientation: 'text',
      resolution: 'text',
      theme: 'text',
      show_header: 'bool',
      show_footer: 'bool',
      show_clock: 'bool',
      ticker_text: 'text',
      active: 'bool',
    },
    required: ['name'],
    orderBy: 'id',
  },
  slides: {
    table: 'slides',
    fields: {
      template: 'text',
      config_json: 'json',
      theme: 'text',
      duration_s: 'int',
      transition: 'text',
      schedule_json: 'json',
      position: 'int',
      active: 'bool',
    },
    required: ['template'],
    orderBy: 'position, id',
  },
  devices: {
    table: 'devices',
    fields: { name: 'text', screen_id: 'ref' },
    required: [],
    orderBy: 'last_seen DESC',
  },
} satisfies Record<string, TableSpec>;

export function slugify(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'item'
  );
}

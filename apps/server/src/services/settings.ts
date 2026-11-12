import type { Db } from '../db/db.js';
import { HttpError } from '../db/repo.js';

/** Opening hours per weekday (0 = Sunday). null means closed. */
export type ClinicHours = Record<string, [string, string] | null>;

export const DEFAULT_SETTINGS = {
  brand_name: 'DrDrip',
  descriptor: 'Medical Aesthetics and Wellness',
  tagline: 'Tu bienestar, nuestra especialidad.',
  phrases: ['Ciencia · Belleza · Bienestar', 'Vitalidad · Bienestar · Equilibrio'] as string[],
  phone: '939-356-5275',
  address: 'Calle Ramón E. Betances #56, Vega Baja, PR',
  hours_text: 'Martes a viernes 9:00 a. m. – 5:00 p. m. · Sábados 8:00 a. m. – 3:00 p. m.',
  instagram: '@DrDrippr',
  clinic_hours: {
    '0': null,
    '1': null,
    '2': ['09:00', '17:00'],
    '3': ['09:00', '17:00'],
    '4': ['09:00', '17:00'],
    '5': ['09:00', '17:00'],
    '6': ['08:00', '15:00'],
  } as ClinicHours,
  benefits: [
    'Rápida absorción',
    'Personalizado a tus necesidades',
    'Directo al torrente sanguíneo',
    'Rehidratación',
    'Mínimos efectos secundarios',
  ] as string[],
  /** Uploaded logo (URL under /media). Empty uses the bundled symbol. */
  logo_path: '',
  /** Percentages, 60–160. */
  logo_size: 100,
  transition_logo_size: 100,
  photo_size: 100,
  /** Seconds each rotating footer message stays on screen. */
  ticker_seconds: 8,
  show_welcome: true,
};

export type Settings = typeof DEFAULT_SETTINGS;
export type SettingKey = keyof Settings;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function validate(key: SettingKey, value: unknown): void {
  const bad = () => new HttpError(400, `Valor inválido para "${key}".`);
  const sample = DEFAULT_SETTINGS[key];
  if (key === 'clinic_hours') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw bad();
    for (let day = 0; day < 7; day++) {
      const range = (value as ClinicHours)[String(day)];
      if (range === null || range === undefined) continue;
      if (!Array.isArray(range) || range.length !== 2 || !TIME.test(range[0]) || !TIME.test(range[1])) throw bad();
    }
    return;
  }
  if (Array.isArray(sample)) {
    if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) throw bad();
    return;
  }
  if (typeof sample === 'number') {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 400) throw bad();
    return;
  }
  if (typeof value !== typeof sample) throw bad();
}

export function getSettings(db: Db): Settings {
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of db.all<{ key: string; value: string }>('SELECT key, value FROM settings')) {
    if (!(row.key in DEFAULT_SETTINGS)) continue;
    try {
      out[row.key] = JSON.parse(row.value);
    } catch {
      /* keep the default when a stored value is corrupt */
    }
  }
  return out as Settings;
}

/** Partial update: only the keys that were sent are written. */
export function patchSettings(db: Db, input: unknown): Settings {
  if (typeof input !== 'object' || input === null || Array.isArray(input))
    throw new HttpError(400, 'Se esperaba un objeto JSON.');
  db.tx(() => {
    for (const [key, value] of Object.entries(input)) {
      if (!(key in DEFAULT_SETTINGS)) throw new HttpError(400, `Ajuste desconocido: "${key}".`);
      validate(key as SettingKey, value);
      setRaw(db, key, JSON.stringify(value));
    }
  });
  return getSettings(db);
}

export function getRaw(db: Db, key: string): string | undefined {
  return db.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', key)?.value;
}

export function setRaw(db: Db, key: string, value: string): void {
  db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}

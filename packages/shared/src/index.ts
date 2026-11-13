export * from './money.js';
export * from './templates.js';

export const APP_VERSION = '0.2.2';
export const CLINIC_TIMEZONE = 'America/Puerto_Rico';
/** Puerto Rico is UTC-4 all year (no daylight saving time). */
export const CLINIC_UTC_OFFSET_MIN = -240;

/** Clinic-local date parts for a given instant, without relying on Intl time zone data. */
export function clinicNow(date: Date = new Date()): { ymd: string; day: number; minutes: number } {
  const shifted = new Date(date.getTime() + CLINIC_UTC_OFFSET_MIN * 60_000);
  return {
    ymd: shifted.toISOString().slice(0, 10),
    day: shifted.getUTCDay(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

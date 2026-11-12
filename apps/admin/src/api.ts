import type { PriceMode, SlideSchedule, SlideSlots } from '@drdrip/shared';

const TOKEN_KEY = 'drdrip.token';

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}
export function setToken(token: string): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

export async function api<T = unknown>(method: string, url: string, body?: unknown, raw?: { type: string }): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${getToken()}` };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (raw) {
    headers['Content-Type'] = raw.type;
    payload = body as string;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(url, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor. Verifica que el programa esté abierto.');
  }
  if (res.status === 401 && !url.endsWith('/auth/login') && !url.endsWith('/system/pin')) onUnauthorized();
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Error ${res.status}`);
  return data as T;
}

export async function upload(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  return (await api<{ url: string }>('POST', '/api/media', form)).url;
}

/** Link to a protected download (CSV, backup). */
export function download(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}token=${getToken()}`;
}

export interface Category { id: number; name: string; slug: string; icon: string; sort_order: number; active: boolean }
export interface Service {
  id: number; name: string; name_en: string; description: string; benefits: string[]; category_id: number | null;
  price_cents: number; price_mode: PriceMode; duration_min: number; image_path: string; badge: string;
  is_featured: boolean; available: boolean; visible: boolean; sort_order: number; updated_at: string;
}
export interface Addon { id: number; name: string; price_cents: number; description: string; sort_order: number; active: boolean }
export interface Promo { id: number; title: string; subtitle: string; image_path: string; starts_at: string; ends_at: string; active: boolean }
export interface Screen {
  id: number; name: string; orientation: 'landscape' | 'portrait'; resolution: string; theme: string;
  show_header: boolean; show_footer: boolean; show_clock: boolean; ticker_text: string; active: boolean;
  slides: number; online: number; dirty: boolean; published_at: string | null;
}
export interface Slide {
  id: number; screen_id: number; template: string; config_json: SlideSlots; theme: string; duration_s: number;
  transition: string; schedule_json: SlideSchedule; position: number; active: boolean;
}
export interface Device {
  id: string; name: string; screen_id: number | null; user_agent: string; ip: string; first_seen: string; last_seen: string;
  online: boolean; showing_screen_id: number | null;
}
export interface Version { id: number; published_at: string; note: string; slides: number }
export interface Settings {
  brand_name: string; descriptor: string; tagline: string; phrases: string[]; phone: string; address: string;
  hours_text: string; instagram: string; clinic_hours: Record<string, [string, string] | null>; benefits: string[];
  logo_path: string; logo_size: number; transition_logo_size: number; photo_size: number; ticker_seconds: number; show_welcome: boolean;
}
export interface Status {
  version: string; uptime_s: number; timezone: string; port: number; urls: string[]; factory_pin: boolean; db_size: number;
  run_mode: 'servicio' | 'consola' | 'desarrollo'; can_restart: boolean; image_resizer: boolean; logs: { name: string; size: number; modified_at: string }[];
  backups: { name: string; size: number; created_at: string }[];
  online: { deviceId: string; screenId: number | null; ip: string }[];
  counts: { services: number; hidden_services: number; addons: number; screens: number; devices: number; unassigned_devices: number };
}
export interface PriceChange { id: number; service_name: string; old_cents: number; new_cents: number; old_mode: PriceMode; new_mode: PriceMode; changed_at: string }

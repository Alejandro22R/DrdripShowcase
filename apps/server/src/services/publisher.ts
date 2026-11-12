import { createHash } from 'node:crypto';
import {
  clinicNow,
  formatCents,
  formatDuration,
  formatPrice,
  getTemplate,
  type FormattedPrice,
  type PriceMode,
  type SlideSchedule,
  type SlideSlots,
} from '@drdrip/shared';
import type { Db, Row } from '../db/db.js';
import { HttpError, SPECS, fromRow, getRow, listRows } from '../db/repo.js';
import { getSettings } from './settings.js';

// ---------------------------------------------------------------------------
// Draft / published model
//
// The `screens` and `slides` tables hold the DRAFT a person is editing.
// Publishing stores a snapshot in `config_versions`; players only ever see the
// latest snapshot. Catalog data (names, prices) is always resolved live, so a
// price change reaches the screens without publishing.
// ---------------------------------------------------------------------------

export interface SnapshotSlide {
  template: string;
  slots: SlideSlots;
  theme: string;
  duration_s: number;
  transition: string;
  schedule: SlideSchedule;
  active: boolean;
}

export interface Snapshot {
  screen: {
    orientation: string;
    resolution: string;
    theme: string;
    show_header: boolean;
    show_footer: boolean;
    show_clock: boolean;
    ticker_text: string;
  };
  slides: SnapshotSlide[];
}

interface ScreenRow {
  id: number;
  name: string;
  orientation: string;
  resolution: string;
  theme: string;
  show_header: boolean;
  show_footer: boolean;
  show_clock: boolean;
  ticker_text: string;
  active: boolean;
}

interface SlideRow {
  id: number;
  template: string;
  config_json: SlideSlots | null;
  theme: string;
  duration_s: number;
  transition: string;
  schedule_json: SlideSchedule | null;
  position: number;
  active: boolean;
}

export function draftSnapshot(db: Db, screenId: number): Snapshot {
  const screen = getRow<ScreenRow>(db, SPECS.screens, screenId);
  const slides = listRows<SlideRow>(db, SPECS.slides, 'screen_id = ?', screenId);
  return {
    screen: {
      orientation: screen.orientation,
      resolution: screen.resolution,
      theme: screen.theme,
      show_header: screen.show_header,
      show_footer: screen.show_footer,
      show_clock: screen.show_clock,
      ticker_text: screen.ticker_text,
    },
    slides: slides.map((s) => ({
      template: s.template,
      slots: s.config_json ?? {},
      theme: s.theme,
      duration_s: s.duration_s,
      transition: s.transition,
      schedule: s.schedule_json ?? {},
      active: s.active,
    })),
  };
}

interface VersionRow {
  id: number;
  screen_id: number;
  snapshot_json: string;
  published_at: string;
  note: string;
}

function latestVersion(db: Db, screenId: number): VersionRow | undefined {
  return db.get<VersionRow>('SELECT * FROM config_versions WHERE screen_id = ? ORDER BY id DESC LIMIT 1', screenId);
}

export function hasUnpublishedChanges(db: Db, screenId: number): boolean {
  const latest = latestVersion(db, screenId);
  return !latest || latest.snapshot_json !== JSON.stringify(draftSnapshot(db, screenId));
}

const MAX_VERSIONS = 50;

export function publishScreen(db: Db, screenId: number, note = ''): { id: number; published_at: string } {
  return db.tx(() => {
    const snapshot = JSON.stringify(draftSnapshot(db, screenId));
    const { id } = db.run(
      'INSERT INTO config_versions (screen_id, snapshot_json, note) VALUES (?, ?, ?)',
      screenId,
      snapshot,
      note.slice(0, 200),
    );
    db.run(
      `DELETE FROM config_versions WHERE screen_id = ? AND id NOT IN
       (SELECT id FROM config_versions WHERE screen_id = ? ORDER BY id DESC LIMIT ${MAX_VERSIONS})`,
      screenId,
      screenId,
    );
    const row = db.get<VersionRow>('SELECT * FROM config_versions WHERE id = ?', id)!;
    return { id, published_at: row.published_at };
  });
}

export function listVersions(db: Db, screenId: number): { id: number; published_at: string; note: string; slides: number }[] {
  return db
    .all<VersionRow>('SELECT * FROM config_versions WHERE screen_id = ? ORDER BY id DESC', screenId)
    .map((v) => ({
      id: v.id,
      published_at: v.published_at,
      note: v.note,
      slides: (JSON.parse(v.snapshot_json) as Snapshot).slides.length,
    }));
}

/** Writes a snapshot back into the draft tables. */
export function applySnapshot(db: Db, screenId: number, snapshot: Snapshot): void {
  db.tx(() => {
    const s = snapshot.screen;
    db.run(
      `UPDATE screens SET orientation = ?, resolution = ?, theme = ?, show_header = ?, show_footer = ?,
       show_clock = ?, ticker_text = ? WHERE id = ?`,
      s.orientation,
      s.resolution,
      s.theme,
      s.show_header ? 1 : 0,
      s.show_footer ? 1 : 0,
      s.show_clock ? 1 : 0,
      s.ticker_text,
      screenId,
    );
    db.run('DELETE FROM slides WHERE screen_id = ?', screenId);
    snapshot.slides.forEach((slide, position) => {
      db.run(
        `INSERT INTO slides (screen_id, template, config_json, theme, duration_s, transition, schedule_json, position, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        screenId,
        slide.template,
        JSON.stringify(slide.slots),
        slide.theme,
        slide.duration_s,
        slide.transition,
        JSON.stringify(slide.schedule),
        position,
        slide.active ? 1 : 0,
      );
    });
  });
}

/** Restores an earlier version into the draft and publishes it again. */
export function restoreVersion(db: Db, versionId: number): { screenId: number; id: number } {
  const version = db.get<VersionRow>('SELECT * FROM config_versions WHERE id = ?', versionId);
  if (!version) throw new HttpError(404, 'No se encontró la versión.');
  return db.tx(() => {
    applySnapshot(db, version.screen_id, JSON.parse(version.snapshot_json) as Snapshot);
    const published = publishScreen(db, version.screen_id, `Restaurada de la versión #${version.id}`);
    return { screenId: version.screen_id, id: published.id };
  });
}

export function duplicateScreen(db: Db, screenId: number, name?: string): number {
  const source = getRow<ScreenRow>(db, SPECS.screens, screenId);
  return db.tx(() => {
    const { id } = db.run('INSERT INTO screens (name) VALUES (?)', name?.trim() || `${source.name} (copia)`);
    applySnapshot(db, id, draftSnapshot(db, screenId));
    return id;
  });
}

// ---------------------------------------------------------------------------
// Player payload: snapshot + live catalog data, with prices already formatted.
// ---------------------------------------------------------------------------

export interface ResolvedService {
  id: number;
  name: string;
  description: string;
  benefits: string[];
  duration: string;
  price: FormattedPrice;
  badge: string;
  image: string;
  icon: string;
  available: boolean;
  featured: boolean;
}

interface ServiceRow {
  id: number;
  name: string;
  description: string;
  benefits: string[] | null;
  category_id: number | null;
  price_cents: number;
  price_mode: PriceMode;
  duration_min: number;
  image_path: string;
  badge: string;
  is_featured: boolean;
  available: boolean;
  visible: boolean;
}

function resolveService(row: ServiceRow, icons: Map<number, string>): ResolvedService {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    benefits: Array.isArray(row.benefits) ? row.benefits.filter((b) => typeof b === 'string') : [],
    duration: formatDuration(row.duration_min),
    price: formatPrice(row.price_mode, row.price_cents),
    badge: row.badge,
    image: row.image_path,
    icon: (row.category_id !== null && icons.get(row.category_id)) || 'drop',
    available: row.available,
    featured: row.is_featured,
  };
}

interface Catalog {
  services: ServiceRow[];
  icons: Map<number, string>;
  activeCategories: Set<number>;
  addons: { name: string; description: string; price: string }[];
  promos: Map<number, Row>;
  today: string;
}

function loadCatalog(db: Db): Catalog {
  const categories = db.all<{ id: number; icon: string; active: number }>('SELECT id, icon, active FROM categories');
  return {
    services: listRows<ServiceRow>(db, SPECS.services, 'visible = 1'),
    icons: new Map(categories.map((c) => [c.id, c.icon])),
    activeCategories: new Set(categories.filter((c) => c.active === 1).map((c) => c.id)),
    addons: db
      .all<{ name: string; description: string; price_cents: number }>(
        'SELECT name, description, price_cents FROM addons WHERE active = 1 ORDER BY sort_order, id',
      )
      .map((a) => ({ name: a.name, description: a.description, price: formatCents(a.price_cents) })),
    promos: new Map(db.all('SELECT * FROM promos').map((p) => [p.id as number, fromRow(SPECS.promos, p)])),
    today: clinicNow().ymd,
  };
}

function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return y && m && d ? `${d} de ${months[m - 1]} de ${y}` : '';
}

export interface ResolvedSlide {
  key: string;
  template: string;
  theme: string;
  duration_s: number;
  transition: string;
  schedule: SlideSchedule;
  slots: SlideSlots;
  data: {
    services?: ResolvedService[];
    addons?: Catalog['addons'];
    promo?: { title: string; subtitle: string; image: string; validity: string };
    items?: string[];
  };
  /** True when the slide has nothing to show; the player swaps in the brand cover. */
  empty: boolean;
}

function resolveSlide(slide: SnapshotSlide, index: number, screenTheme: string, catalog: Catalog, benefits: string[]): ResolvedSlide {
  const meta = getTemplate(slide.template);
  const slots = slide.slots ?? {};
  const data: ResolvedSlide['data'] = {};
  let empty = !meta;
  const source = slots.source;

  if (meta && meta.sources.length > 0) {
    if (source?.type === 'category' && meta.sources.includes('category')) {
      data.services = catalog.activeCategories.has(source.categoryId ?? -1)
        ? catalog.services.filter((s) => s.category_id === source.categoryId).map((s) => resolveService(s, catalog.icons))
        : [];
      empty = data.services.length === 0;
    } else if (source?.type === 'services' && meta.sources.includes('services')) {
      const byId = new Map(catalog.services.map((s) => [s.id, s]));
      data.services = (source.serviceIds ?? [])
        .map((id) => byId.get(id))
        .filter((s): s is ServiceRow => s !== undefined)
        .map((s) => resolveService(s, catalog.icons));
      empty = data.services.length === 0;
    } else if (source?.type === 'promo' && meta.sources.includes('promo')) {
      const promo = catalog.promos.get(source.promoId ?? -1) as
        | { title: string; subtitle: string; image_path: string; starts_at: string; ends_at: string; active: boolean }
        | undefined;
      const inDates =
        promo && (!promo.starts_at || promo.starts_at <= catalog.today) && (!promo.ends_at || promo.ends_at >= catalog.today);
      if (promo && promo.active && inDates) {
        data.promo = {
          title: promo.title,
          subtitle: promo.subtitle,
          image: promo.image_path,
          validity: promo.ends_at ? `Válido hasta el ${formatDate(promo.ends_at)}` : '',
        };
      } else empty = true;
    } else empty = true;
  }

  if (meta?.id === 'build-your-drip') data.addons = catalog.addons;
  if (meta?.id === 'benefits') {
    data.items = slots.items && slots.items.length ? slots.items : benefits;
    empty = data.items.length === 0;
  }
  if (meta?.id === 'team') empty = !slots.people || slots.people.length === 0;
  if (meta?.id === 'free') empty = !slots.title && !slots.body && !slots.image && !slots.video;

  return {
    key: `s${index}`,
    template: slide.template,
    theme: slide.theme || screenTheme,
    duration_s: Math.min(Math.max(slide.duration_s, 3), 600),
    transition: slide.transition,
    schedule: slide.schedule ?? {},
    slots,
    data,
    empty,
  };
}

export function buildPlayerPayload(db: Db, screenId: number, opts: { draft?: boolean } = {}) {
  const screen = getRow<ScreenRow>(db, SPECS.screens, screenId);
  const version = opts.draft ? undefined : latestVersion(db, screenId);
  const snapshot: Snapshot | null = opts.draft
    ? draftSnapshot(db, screenId)
    : version
      ? (JSON.parse(version.snapshot_json) as Snapshot)
      : null;

  const settings = getSettings(db);
  const catalog = loadCatalog(db);
  const cfg = snapshot?.screen ?? draftSnapshot(db, screenId).screen;
  const slides =
    snapshot && (screen.active || opts.draft)
      ? snapshot.slides
          .map((slide, i) => ({ slide, i }))
          .filter(({ slide }) => slide.active)
          .map(({ slide, i }) => resolveSlide(slide, i, cfg.theme, catalog, settings.benefits))
      : [];

  const body = {
    screen: {
      id: screen.id,
      name: screen.name,
      orientation: cfg.orientation,
      resolution: cfg.resolution,
      theme: cfg.theme,
      show_header: cfg.show_header,
      show_footer: cfg.show_footer,
      show_clock: cfg.show_clock,
      ticker: cfg.ticker_text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    },
    brand: {
      name: settings.brand_name,
      descriptor: settings.descriptor,
      tagline: settings.tagline,
      phrases: settings.phrases,
      phone: settings.phone,
      address: settings.address,
      hours_text: settings.hours_text,
      instagram: settings.instagram,
      clinic_hours: settings.clinic_hours,
      logo: settings.logo_path,
      logo_size: settings.logo_size,
      transition_logo_size: settings.transition_logo_size,
      photo_size: settings.photo_size,
      ticker_seconds: settings.ticker_seconds,
      show_welcome: settings.show_welcome,
    },
    slides,
    version: opts.draft ? 'draft' : (version?.id ?? 0),
  };
  // The player compares this hash to skip re-rendering when nothing changed.
  const etag = createHash('sha1').update(JSON.stringify(body)).digest('hex').slice(0, 16);
  return { ...body, etag };
}

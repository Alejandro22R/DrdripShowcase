// Each entry is one migration. Never edit a published entry; append a new one.
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_en TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    benefits TEXT NOT NULL DEFAULT '[]',
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
    price_mode TEXT NOT NULL DEFAULT 'fixed' CHECK (price_mode IN ('fixed','from','ask')),
    duration_min INTEGER NOT NULL DEFAULT 0,
    image_path TEXT NOT NULL DEFAULT '',
    badge TEXT NOT NULL DEFAULT '',
    is_featured INTEGER NOT NULL DEFAULT 0,
    available INTEGER NOT NULL DEFAULT 1,
    visible INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX services_category ON services(category_id, sort_order);

  CREATE TABLE addons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
    description TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE service_addons (
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    addon_id INTEGER NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
    PRIMARY KEY (service_id, addon_id)
  );

  CREATE TABLE promos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL DEFAULT '',
    image_path TEXT NOT NULL DEFAULT '',
    starts_at TEXT NOT NULL DEFAULT '',
    ends_at TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE screens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    orientation TEXT NOT NULL DEFAULT 'landscape' CHECK (orientation IN ('landscape','portrait')),
    resolution TEXT NOT NULL DEFAULT '1080p',
    theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark','sage','light')),
    show_header INTEGER NOT NULL DEFAULT 1,
    show_footer INTEGER NOT NULL DEFAULT 1,
    show_clock INTEGER NOT NULL DEFAULT 1,
    ticker_text TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE slides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    screen_id INTEGER NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
    template TEXT NOT NULL,
    config_json TEXT NOT NULL DEFAULT '{}',
    theme TEXT NOT NULL DEFAULT '',
    duration_s INTEGER NOT NULL DEFAULT 12,
    transition TEXT NOT NULL DEFAULT 'fade',
    schedule_json TEXT NOT NULL DEFAULT '{}',
    position INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX slides_screen ON slides(screen_id, position);

  CREATE TABLE config_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    screen_id INTEGER NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
    snapshot_json TEXT NOT NULL,
    published_at TEXT NOT NULL DEFAULT (datetime('now')),
    note TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX versions_screen ON config_versions(screen_id, id);

  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    old_cents INTEGER NOT NULL,
    new_cents INTEGER NOT NULL,
    old_mode TEXT NOT NULL DEFAULT 'fixed',
    new_mode TEXT NOT NULL DEFAULT 'fixed',
    changed_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE devices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    screen_id INTEGER REFERENCES screens(id) ON DELETE SET NULL,
    user_agent TEXT NOT NULL DEFAULT '',
    ip TEXT NOT NULL DEFAULT '',
    first_seen TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE sessions (
    token TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `,
];

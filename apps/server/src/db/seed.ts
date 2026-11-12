import type { PriceMode, SlideSlots } from '@drdrip/shared';
import type { Db } from './db.js';
import { slugify } from './repo.js';
import { publishScreen } from '../services/publisher.js';

// Initial catalog taken from the public menu at drdrippr.com.
// Prices are integer cents. The client must confirm them before going live.

type SeedService = [name: string, cents: number, mode?: PriceMode, extra?: { visible?: boolean; duration?: number }];

const DRIP_MIN = 90;

const CATALOG: { name: string; icon: string; duration?: number; services: SeedService[] }[] = [
  { name: 'Consulta', icon: 'stethoscope', services: [['Consulta médica', 4500, 'from', { duration: 30 }]] },
  {
    name: 'Drips',
    icon: 'drop',
    duration: DRIP_MIN,
    services: [
      ['Glutathione Drip', 5900],
      ['Multivitamin Drip', 10000],
      ['Vitamin C Drip 5,000 mg', 10000],
      ['Bariatric Drip', 11900],
      ['Anti-Migraine Drip', 12900],
      ['PMS Drip', 12900],
      ['Male Booster Drip', 13900],
      ['After Party Drip', 14900],
      ['Beauty Drip', 14900],
      ['Immune Booster Drip', 14900],
      ['Myers Drip', 15900],
      ['Pre-Workout Drip', 15900],
      ['Energy Booster Drip', 15900],
      ['Vitamin C Drip 10,000 mg', 15900],
      ['Skinny Drip', 15900],
      ['NAD 250 mg', 16500],
      ['Post-Workout Drip', 16900],
      ['NAD 500 mg', 21900],
    ],
  },
  {
    name: 'Inyectables',
    icon: 'syringe',
    services: [
      ['Shot de Vitamina B12', 2500],
      ['Shot de Vitamina D', 2500],
      ['Shot de Biotina', 2500],
      ['Tri-Immune Shot', 4000],
      ['Ultra Fat Burn Shot', 4000, 'from'],
      ['Relax Shot', 0, 'ask'],
    ],
  },
  {
    // Prescription drugs: hidden until the medical director approves showing them.
    name: 'Control de peso',
    icon: 'scale',
    services: [
      ['Semaglutide', 0, 'ask', { visible: false }],
      ['Tirzepatide', 0, 'ask', { visible: false }],
    ],
  },
  {
    name: 'Remoción',
    icon: 'sparkle',
    services: [
      ['Remoción de verrugas', 0, 'ask'],
      ['Remoción de lunares', 0, 'ask'],
      ['Remoción de acrocordones', 0, 'ask'],
    ],
  },
  {
    name: 'Lipólisis localizada',
    icon: 'wave',
    services: [
      ['Drenaje linfático', 0, 'ask'],
      ['Ultra cavitación', 0, 'ask'],
      ['Ultrasonido', 0, 'ask'],
      ['Corrientes rusas', 0, 'ask'],
    ],
  },
  { name: 'Gift Cards', icon: 'gift', services: [['Gift Card', 0, 'ask']] },
];

const ADDONS: [string, number][] = [
  ['Ketorolac (Toradol®)', 1000],
  ['Famotidine (Pepcid®)', 1000],
  ['Ondansetron (Zofran®)', 1000],
  ['Dexamethasone (Decadron®)', 1000],
  ['Vitamina C', 1500],
  ['Biotina', 1500],
  ['Vitamina B12', 1500],
];

export function isEmptyDb(db: Db): boolean {
  return (db.get<{ n: number }>('SELECT COUNT(*) AS n FROM categories')?.n ?? 0) === 0;
}

export function seed(db: Db): void {
  db.tx(() => {
    const categoryIds: Record<string, number> = {};
    CATALOG.forEach((cat, ci) => {
      const { id } = db.run(
        'INSERT INTO categories (name, slug, icon, sort_order) VALUES (?, ?, ?, ?)',
        cat.name,
        slugify(cat.name),
        cat.icon,
        ci,
      );
      categoryIds[cat.name] = id;
      cat.services.forEach(([name, cents, mode = 'fixed', extra = {}], si) => {
        db.run(
          `INSERT INTO services (name, category_id, price_cents, price_mode, duration_min, visible, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          name,
          id,
          cents,
          mode,
          extra.duration ?? cat.duration ?? 0,
          extra.visible === false ? 0 : 1,
          si,
        );
      });
    });
    ADDONS.forEach(([name, cents], i) => {
      db.run('INSERT INTO addons (name, price_cents, sort_order) VALUES (?, ?, ?)', name, cents, i);
    });
    db.run(
      `INSERT INTO promos (title, subtitle, active) VALUES ('Gift Cards', '¡Regala salud!', 1)`,
    );

    const { id: screenId } = db.run(
      `INSERT INTO screens (name, ticker_text) VALUES ('Sala de espera', ?)`,
      ['Tu bienestar, nuestra especialidad.', 'Pregunta por nuestras Gift Cards: ¡regala salud!', 'Síguenos en @DrDrippr'].join(
        '\n',
      ),
    );
    const drips = categoryIds['Drips'];
    const slides: [string, SlideSlots, number, string][] = [
      ['brand-cover', {}, 10, 'sage'],
      ['drip-menu', { title: 'Menú de Drips', subtitle: 'Infusiones intravenosas · 1 h 30 min', columns: 2, source: { type: 'category', categoryId: drips } }, 20, ''],
      ['benefits', { title: 'Beneficios de la terapia IV' }, 12, 'light'],
      ['build-your-drip', { title: 'Arma tu Drip', subtitle: 'Elige tu drip y personalízalo con complementos', source: { type: 'category', categoryId: drips } }, 18, ''],
      ['service-cards', { title: 'Inyectables', grid: '3x2', source: { type: 'category', categoryId: categoryIds['Inyectables'] } }, 15, ''],
      ['promo', { source: { type: 'promo', promoId: 1 } }, 10, 'sage'],
    ];
    slides.forEach(([template, slots, duration, theme], position) => {
      db.run(
        `INSERT INTO slides (screen_id, template, config_json, theme, duration_s, transition, position)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        screenId,
        template,
        JSON.stringify(slots),
        theme,
        duration,
        position % 2 === 0 ? 'curtain' : 'fade',
        position,
      );
    });
    publishScreen(db, screenId, 'Configuración inicial');
  });
}

// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';

let V;
beforeAll(async () => {
  await import('../engine/schedule.js');
  await import('../engine/dom.js');
  await import('../engine/core.js');
  for (const name of ['brand-cover', 'drip-menu', 'service-cards', 'featured-service', 'build-your-drip', 'compact-list', 'promo', 'benefits', 'team', 'free']) {
    await import(`../templates/${name}.js`);
  }
  V = window.Vitrina;
});

const HOURS = { 0: null, 1: null, 2: ['09:00', '17:00'], 3: ['09:00', '17:00'], 4: ['09:00', '17:00'], 5: ['09:00', '17:00'], 6: ['08:00', '15:00'] };
// 2026-11-10 is a Tuesday. Clinic time is UTC-4.
const at = (iso) => new Date(iso);

const service = (over = {}) => ({
  id: 1, name: 'Myers Drip', description: '', benefits: [], duration: '1 h 30 min',
  price: { mode: 'fixed', prefix: '', text: '$159' }, badge: '', image: '', icon: 'drop', available: true, featured: false, ...over,
});
const slide = (template, over = {}) => ({
  key: 's0', template, theme: 'dark', duration_s: 10, transition: 'fade', schedule: {}, slots: {}, data: {}, empty: false, ...over,
});
const ctx = (over = {}) => ({ brand: { ...V.DEFAULT_BRAND, phrases: ['Ciencia · Belleza · Bienestar'] }, screen: { orientation: 'landscape' }, cycle: 0, ...over });

describe('schedule', () => {
  it('converts to clinic time (UTC-4, no daylight saving)', () => {
    expect(V.clinicTime(at('2026-11-10T13:30:00Z'))).toMatchObject({ day: 2, minutes: 9 * 60 + 30 });
    expect(V.clinicTime(at('2026-07-01T02:00:00Z'))).toMatchObject({ day: 2, minutes: 22 * 60 }); // still Tuesday night
  });

  it('knows when the clinic is open', () => {
    const open = (iso) => V.isClinicOpen(HOURS, V.clinicTime(at(iso)));
    expect(open('2026-11-10T13:00:00Z')).toBe(true); // Tue 9:00
    expect(open('2026-11-10T12:59:00Z')).toBe(false); // Tue 8:59
    expect(open('2026-11-10T21:00:00Z')).toBe(false); // Tue 17:00, closing time
    expect(open('2026-11-09T15:00:00Z')).toBe(false); // Monday
    expect(open('2026-11-14T12:30:00Z')).toBe(true); // Sat 8:30
  });

  it('filters slides by day, hour and clinic hours', () => {
    const tueMorning = at('2026-11-10T14:00:00Z'); // Tue 10:00
    const tueNight = at('2026-11-11T01:00:00Z'); // Tue 21:00
    const active = (schedule, date) => V.isSlideActive(schedule, HOURS, date);
    expect(active({}, tueMorning)).toBe(true);
    expect(active(undefined, tueMorning)).toBe(true);
    expect(active({ days: [2, 4] }, tueMorning)).toBe(true);
    expect(active({ days: [1, 3] }, tueMorning)).toBe(false);
    expect(active({ from: '09:00', to: '12:00' }, tueMorning)).toBe(true);
    expect(active({ from: '12:00', to: '15:00' }, tueMorning)).toBe(false);
    expect(active({ from: '20:00', to: '06:00' }, tueNight)).toBe(true); // wraps midnight
    expect(active({ from: '20:00', to: '06:00' }, tueMorning)).toBe(false);
    expect(active({ clinic: 'open' }, tueMorning)).toBe(true);
    expect(active({ clinic: 'open' }, tueNight)).toBe(false);
    expect(active({ clinic: 'closed' }, tueNight)).toBe(true);
    const slides = [{ key: 'a', schedule: { clinic: 'open' } }, { key: 'b', schedule: { clinic: 'closed' } }, { key: 'c' }];
    expect(V.activeSlides(slides, HOURS, tueNight).map((s) => s.key)).toEqual(['b', 'c']);
  });

  it('formats the clock in 12-hour clinic time', () => {
    expect(V.formatClock(at('2026-11-10T13:05:00Z'))).toEqual({ time: '9:05', suffix: 'a. m.', date: 'martes 10 de noviembre' });
    expect(V.formatClock(at('2026-11-10T16:00:00Z')).time).toBe('12:00');
    expect(V.formatClock(at('2026-11-10T04:30:00Z'))).toMatchObject({ time: '12:30', suffix: 'a. m.' });
  });
});

describe('template engine', () => {
  it('registers every template of the catalog', () => {
    expect(Object.keys(V.templates).sort()).toEqual(
      ['benefits', 'brand-cover', 'build-your-drip', 'compact-list', 'drip-menu', 'featured-service', 'free', 'promo', 'service-cards', 'team'],
    );
  });

  it('renders the drip menu with names and prices', () => {
    const services = [service(), service({ id: 2, name: 'NAD 500 mg', price: { mode: 'fixed', prefix: '', text: '$219' } })];
    const { el } = V.renderSlide(slide('drip-menu', { slots: { title: 'Menú de Drips', columns: 2 }, data: { services } }), ctx());
    expect(el.className).toContain('theme-dark');
    expect(el.querySelector('.title').textContent).toBe('Menú de Drips');
    expect([...el.querySelectorAll('.menu-row')].map((r) => r.querySelector('.menu-name').textContent)).toEqual(['Myers Drip', 'NAD 500 mg']);
    expect([...el.querySelectorAll('.price-amount')].map((p) => p.textContent)).toEqual(['$159', '$219']);
    expect(el.querySelectorAll('.menu-list')).toHaveLength(2);
    expect(el.querySelector('.kicker').textContent).toBe('1 h 30 min cada una'); // shared duration said once
  });

  it('shows "Desde", "Consultar" and unavailable services', () => {
    const services = [
      service({ name: 'Consulta', price: { mode: 'from', prefix: 'Desde', text: '$45' }, duration: '30 min' }),
      service({ name: 'Relax Shot', price: { mode: 'ask', prefix: '', text: 'Consultar' }, duration: '' }),
      service({ name: 'Agotado', available: false }),
    ];
    const { el } = V.renderSlide(slide('compact-list', { data: { services } }), ctx());
    const rows = el.querySelectorAll('.menu-row');
    expect(rows[0].querySelector('.price-prefix').textContent).toBe('Desde');
    expect(rows[0].querySelector('.menu-duration').textContent).toBe('30 min');
    expect(rows[1].querySelector('.price').className).toContain('price-ask');
    expect(rows[2].className).toContain('is-unavailable');
    expect(rows[2].querySelector('.price')).toBeNull();
  });

  it('never injects markup from catalog text', () => {
    const { el } = V.renderSlide(slide('drip-menu', { slots: { title: '<img src=x onerror=alert(1)>' }, data: { services: [service({ name: '<b>x</b>' })] } }), ctx());
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('b')).toBeNull();
    expect(el.querySelector('.menu-name').textContent).toBe('<b>x</b>');
  });

  it('paginates cards when there are more services than cells', () => {
    const services = Array.from({ length: 7 }, (_, i) => service({ id: i, name: `Servicio ${i + 1}` }));
    const s = slide('service-cards', { slots: { grid: '2x2' }, data: { services } });
    expect(V.slidePages(s, ctx())).toBe(2);
    const first = V.renderSlide(s, ctx({ cycle: 0 })).el;
    const second = V.renderSlide(s, ctx({ cycle: 1 })).el;
    expect(first.querySelectorAll('.card')).toHaveLength(4);
    expect([...second.querySelectorAll('.card-name')].map((n) => n.textContent)).toEqual(['Servicio 5', 'Servicio 6', 'Servicio 7']);
    expect(first.querySelector('.pager').textContent).toBe('1 / 2');
  });

  it('swaps the grid on vertical screens', () => {
    const services = Array.from({ length: 6 }, (_, i) => service({ id: i }));
    const s = slide('service-cards', { slots: { grid: '3x2' }, data: { services } });
    const el = V.renderSlide(s, ctx({ screen: { orientation: 'portrait' } })).el;
    expect(el.querySelector('.cards-grid').style.gridTemplateColumns).toBe('repeat(2, 1fr)');
  });

  it('renders build-your-drip with add-ins', () => {
    const data = { services: [service()], addons: [{ name: 'Biotina', description: '', price: '$15' }] };
    const { el } = V.renderSlide(slide('build-your-drip', { data }), ctx());
    expect(el.querySelector('.build-addons .price-amount').textContent).toBe('+ $15');
  });

  it('renders the remaining templates', () => {
    const featured = V.renderSlide(slide('featured-service', { data: { services: [service({ benefits: ['Energía'], description: 'Clásico' })] } }), ctx()).el;
    expect(featured.querySelector('.featured-name').textContent).toBe('Myers Drip');
    expect(featured.querySelector('.featured-benefits li').textContent).toContain('Energía');

    const promo = V.renderSlide(slide('promo', { data: { promo: { title: 'Gift Cards', subtitle: '¡Regala salud!', image: '', validity: 'Válido hasta el 31 de diciembre de 2026' } } }), ctx()).el;
    expect(promo.querySelector('.promo-validity').textContent).toContain('31 de diciembre');

    const benefits = V.renderSlide(slide('benefits', { data: { items: ['Rápida absorción', 'Rehidratación'] } }), ctx()).el;
    expect(benefits.querySelectorAll('.benefit')).toHaveLength(2);

    const team = V.renderSlide(slide('team', { slots: { people: [{ name: 'Ana Ríos', role: 'Enfermera' }] } }), ctx()).el;
    expect(team.querySelector('.person-photo span').textContent).toBe('AR');

    const free = V.renderSlide(slide('free', { slots: { title: 'Aviso', body: 'Línea uno\nLínea dos' } }), ctx()).el;
    expect(free.querySelectorAll('.free-body')).toHaveLength(2);
  });

  it('falls back to the brand cover for empty, unknown or broken slides', () => {
    const cover = (s) => V.renderSlide(s, ctx());
    for (const s of [slide('drip-menu', { empty: true }), slide('does-not-exist'), slide('promo', { data: {} })]) {
      const { el, fullBleed } = cover(s);
      expect(el.querySelector('.tpl-cover')).not.toBeNull();
      expect(el.querySelector('.cover-name').textContent).toBe('DrDrip');
      expect(fullBleed).toBe(true);
    }
  });

  it('adding a template needs no engine change', () => {
    V.registerTemplate('hello', { render: (s) => V.h('div', { class: 'tpl tpl-hello' }, s.slots.title) });
    const { el } = V.renderSlide(slide('hello', { slots: { title: 'Hola' } }), ctx());
    expect(el.querySelector('.tpl-hello').textContent).toBe('Hola');
    delete V.templates.hello;
  });
});

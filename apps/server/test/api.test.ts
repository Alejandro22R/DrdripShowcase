import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.app.close());

describe('access', () => {
  it('protects the admin API with the PIN', async () => {
    const anon = await t.app.inject({ method: 'GET', url: '/api/services' });
    expect(anon.statusCode).toBe(401);
    const bad = await t.app.inject({ method: 'POST', url: '/api/auth/login', payload: { pin: '0000' } });
    expect(bad.statusCode).toBe(401);
    expect((await t.api('GET', '/api/services')).status).toBe(200);
  });

  it('leaves the player endpoints open but not the draft', async () => {
    expect((await t.app.inject({ url: '/api/health' })).statusCode).toBe(200);
    expect((await t.app.inject({ url: '/api/player/1' })).statusCode).toBe(200);
    expect((await t.app.inject({ url: '/api/player/1?draft=1' })).statusCode).toBe(401);
    expect((await t.app.inject({ url: `/api/player/1?draft=1&token=${t.token}` })).statusCode).toBe(200);
  });

  it('locks out after repeated wrong PINs', async () => {
    const attempt = () => t.app.inject({ method: 'POST', url: '/api/auth/login', payload: { pin: 'nope' }, remoteAddress: '10.9.9.9' });
    for (let i = 0; i < 5; i++) expect((await attempt()).statusCode).toBe(401);
    expect((await attempt()).statusCode).toBe(429);
  });
});

describe('seeded catalog', () => {
  it('loads the menu with integer cents and price modes', async () => {
    const services = (await t.api('GET', '/api/services')).json as any[];
    const byName = (name: string) => services.find((s) => s.name === name);
    expect(services.length).toBe(35);
    expect(byName('Myers Drip')).toMatchObject({ price_cents: 15900, price_mode: 'fixed', duration_min: 90 });
    expect(byName('Consulta médica')).toMatchObject({ price_cents: 4500, price_mode: 'from', duration_min: 30 });
    expect(byName('Relax Shot')).toMatchObject({ price_mode: 'ask' });
    expect(services.every((s) => Number.isInteger(s.price_cents))).toBe(true);
    expect(((await t.api('GET', '/api/addons')).json as any[]).length).toBe(7);
  });

  it('keeps prescription drugs hidden until approved', async () => {
    const services = (await t.api('GET', '/api/services')).json as any[];
    for (const name of ['Semaglutide', 'Tirzepatide']) expect(services.find((s) => s.name === name).visible).toBe(false);
  });
});

describe('services', () => {
  it('PATCH changes only the fields that were sent', async () => {
    const created = (await t.api('POST', '/api/services', {
      name: 'Prueba Drip',
      description: 'Descripción larga',
      benefits: ['Uno', 'Dos'],
      price_cents: 12345,
      duration_min: 45,
      badge: 'Nuevo',
      category_id: 2,
    })).json;
    expect(created.id).toBeGreaterThan(0);

    const patched = (await t.api('PATCH', `/api/services/${created.id}`, { price_cents: 20000 })).json;
    expect(patched).toMatchObject({
      name: 'Prueba Drip',
      description: 'Descripción larga',
      benefits: ['Uno', 'Dos'],
      price_cents: 20000,
      duration_min: 45,
      badge: 'Nuevo',
      category_id: 2,
      visible: true,
      available: true,
    });

    const toggled = (await t.api('PATCH', `/api/services/${created.id}`, { available: false })).json;
    expect(toggled).toMatchObject({ price_cents: 20000, description: 'Descripción larga', available: false });
  });

  it('records the price history', async () => {
    const svc = ((await t.api('GET', '/api/services')).json as any[]).find((s) => s.name === 'Prueba Drip');
    await t.api('PATCH', `/api/services/${svc.id}`, { price_mode: 'from' });
    await t.api('PATCH', `/api/services/${svc.id}`, { name: 'Prueba Drip 2' }); // not a price change
    const history = (await t.api('GET', `/api/price-history?service_id=${svc.id}`)).json as any[];
    expect(history.map((h) => [h.old_cents, h.new_cents, h.old_mode, h.new_mode])).toEqual([
      [20000, 20000, 'fixed', 'from'],
      [12345, 20000, 'fixed', 'fixed'],
    ]);
  });

  it('rejects invalid money and modes', async () => {
    expect((await t.api('PATCH', '/api/services/1', { price_cents: 15.5 })).status).toBe(400);
    expect((await t.api('PATCH', '/api/services/1', { price_cents: -1 })).status).toBe(400);
    expect((await t.api('PATCH', '/api/services/1', { price_mode: 'free' })).status).toBe(400);
    expect((await t.api('PATCH', '/api/services/1', { name: '' })).status).toBe(400);
    expect((await t.api('POST', '/api/services', { price_cents: 100 })).status).toBe(400);
    expect((await t.api('PATCH', '/api/services/99999', { name: 'x' })).status).toBe(404);
  });

  it('adjusts prices in bulk by category with integer math', async () => {
    const before = (await t.api('GET', '/api/services')).json as any[];
    const res = await t.api('POST', '/api/services/bulk-adjust', { basis_points: 1000, category_id: 3, round_to_dollar: true });
    expect(res.status).toBe(200);
    const after = (await t.api('GET', '/api/services')).json as any[];
    const b12 = (list: any[]) => list.find((s) => s.name === 'Shot de Vitamina B12').price_cents;
    expect(b12(before)).toBe(2500);
    expect(b12(after)).toBe(2800); // 2750 rounded to the dollar
    const myers = (list: any[]) => list.find((s) => s.name === 'Myers Drip').price_cents;
    expect(myers(after)).toBe(myers(before)); // other category untouched
    expect(after.find((s) => s.name === 'Relax Shot').price_cents).toBe(0); // "Consultar" untouched
  });
});

describe('CSV', () => {
  it('exports and re-imports without losing data', async () => {
    const csv = (await t.api('GET', '/api/services/export.csv')).text;
    expect(csv).toContain('nombre,categoria,precio');
    expect(csv).toContain('"Vitamin C Drip 5,000 mg"');
    const res = await t.api('POST', '/api/services/import', csv, { 'content-type': 'text/csv' });
    expect(res.json).toMatchObject({ created: 0, price_changes: 0 });
  });

  it('updates by name, creates new rows and refuses bad prices', async () => {
    const ok = await t.api('POST', '/api/services/import', 'nombre,precio\nMyers Drip,165.50\nNuevo Shot,30\n', { 'content-type': 'text/csv' });
    expect(ok.json).toEqual({ created: 1, updated: 1, price_changes: 1 });
    const services = (await t.api('GET', '/api/services')).json as any[];
    expect(services.find((s) => s.name === 'Myers Drip')).toMatchObject({ price_cents: 16550, duration_min: 90, category_id: 2 });

    const bad = await t.api('POST', '/api/services/import', 'nombre,precio\nMyers Drip,abc\nOtro,10\n', { 'content-type': 'text/csv' });
    expect(bad.status).toBe(400);
    expect(((await t.api('GET', '/api/services')).json as any[]).some((s) => s.name === 'Otro')).toBe(false);
  });
});

describe('settings', () => {
  it('patches single keys and validates them', async () => {
    const res = await t.api('PATCH', '/api/settings', { phone: '787-000-0000' });
    expect(res.json.phone).toBe('787-000-0000');
    expect(res.json.address).toContain('Vega Baja');
    expect((await t.api('PATCH', '/api/settings', { clinic_hours: { '2': ['9', '17:00'] } })).status).toBe(400);
    expect((await t.api('PATCH', '/api/settings', { pin_hash: 'x' })).status).toBe(400);
  });
});

describe('PIN', () => {
  it('changes the PIN and drops the factory warning', async () => {
    expect((await t.api('GET', '/api/system/status')).json.factory_pin).toBe(true);
    expect((await t.api('POST', '/api/system/pin', { current: '9999', next: '4321' })).status).toBe(401);
    expect((await t.api('POST', '/api/system/pin', { current: '1234', next: '12' })).status).toBe(400);
    expect((await t.api('POST', '/api/system/pin', { current: '1234', next: '4321' })).status).toBe(204);
    expect((await t.api('GET', '/api/system/status')).json.factory_pin).toBe(false);
    const old = await t.app.inject({ method: 'POST', url: '/api/auth/login', payload: { pin: '1234' } });
    expect(old.statusCode).toBe(401);
  });
});

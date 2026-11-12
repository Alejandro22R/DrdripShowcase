import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBackup, ensureDailyBackup, listBackups } from '../src/services/backup.js';
import { lanAddresses } from '../src/services/network.js';
import { createTestApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.app.close());

const player = async (id: number, draft = false) =>
  (await t.api('GET', `/api/player/${id}${draft ? '?draft=1' : ''}`)).json;

describe('player payload', () => {
  it('serves the published seed with formatted prices', async () => {
    const payload = await player(1);
    expect(payload.screen).toMatchObject({ id: 1, name: 'Sala de espera', theme: 'dark' });
    expect(payload.brand.phone).toBe('939-356-5275');
    expect(payload.slides.map((s: any) => s.template)).toEqual([
      'brand-cover', 'drip-menu', 'benefits', 'build-your-drip', 'service-cards', 'promo',
    ]);
    const menu = payload.slides[1];
    expect(menu.data.services).toHaveLength(18);
    expect(menu.data.services[0]).toMatchObject({
      name: 'Glutathione Drip',
      duration: '1 h 30 min',
      price: { mode: 'fixed', prefix: '', text: '$59' },
    });
    const cards = payload.slides[4].data.services;
    expect(cards.find((s: any) => s.name === 'Ultra Fat Burn Shot').price).toEqual({ mode: 'from', prefix: 'Desde', text: '$40' });
    expect(cards.find((s: any) => s.name === 'Relax Shot').price.text).toBe('Consultar');
    expect(payload.slides[3].data.addons[0]).toEqual({ name: 'Ketorolac (Toradol®)', description: '', price: '$10' });
    expect(payload.slides[2].data.items).toHaveLength(5);
  });

  it('shows price changes live, without publishing', async () => {
    const before = await player(1);
    await t.api('PATCH', '/api/services/2', { price_cents: 6500 });
    const after = await player(1);
    expect(after.slides[1].data.services[0].price.text).toBe('$65');
    expect(after.etag).not.toBe(before.etag);
    expect(after.version).toBe(before.version);
  });

  it('leaves hidden services out', async () => {
    await t.api('PATCH', '/api/services/3', { visible: false });
    const names = (await player(1)).slides[1].data.services.map((s: any) => s.name);
    expect(names).not.toContain('Multivitamin Drip');
    expect(names).toHaveLength(17);
  });

  it('marks slides without content as empty', async () => {
    const screen = (await t.api('POST', '/api/screens', { name: 'Vacía' })).json;
    await t.api('POST', `/api/screens/${screen.id}/slides`, { template: 'drip-menu' }); // no source chosen
    await t.api('POST', `/api/screens/${screen.id}/slides`, {
      template: 'promo',
      config_json: { source: { type: 'promo', promoId: 1 } },
    });
    await t.api('PATCH', '/api/promos/1', { ends_at: '2020-01-01' }); // expired
    const draft = await player(screen.id, true);
    expect(draft.slides.map((s: any) => s.empty)).toEqual([true, true]);
    await t.api('PATCH', '/api/promos/1', { ends_at: '' });
    expect((await player(screen.id, true)).slides[1].empty).toBe(false);
    expect((await player(screen.id)).slides).toEqual([]); // never published
  });

  it('returns 404 for unknown screens', async () => {
    expect((await t.api('GET', '/api/player/999')).status).toBe(404);
  });
});

describe('draft, publish and versions', () => {
  it('keeps edits in the draft until Publish', async () => {
    const slides = (await t.api('GET', '/api/screens/1/slides')).json as any[];
    await t.api('PATCH', `/api/slides/${slides[1].id}`, { config_json: { ...slides[1].config_json, title: 'Nuestros Drips' } });
    await t.api('PATCH', '/api/screens/1', { theme: 'light' });

    expect((await player(1)).slides[1].slots.title).toBe('Menú de Drips');
    expect((await player(1)).screen.theme).toBe('dark');
    expect((await player(1, true)).slides[1].slots.title).toBe('Nuestros Drips');
    const listed = ((await t.api('GET', '/api/screens')).json as any[]).find((s) => s.id === 1);
    expect(listed.dirty).toBe(true);

    await t.api('POST', '/api/screens/1/publish', { note: 'Título nuevo' });
    expect((await player(1)).slides[1].slots.title).toBe('Nuestros Drips');
    expect((await player(1)).screen.theme).toBe('light');
    expect(((await t.api('GET', '/api/screens')).json as any[]).find((s) => s.id === 1).dirty).toBe(false);
  });

  it('PATCH on a slide keeps its other fields', async () => {
    const slide = ((await t.api('GET', '/api/screens/1/slides')).json as any[])[1];
    const patched = (await t.api('PATCH', `/api/slides/${slide.id}`, { duration_s: 30 })).json;
    expect(patched).toMatchObject({ template: 'drip-menu', duration_s: 30, transition: slide.transition });
    expect(patched.config_json).toEqual(slide.config_json);
    expect((await t.api('PATCH', `/api/slides/${slide.id}`, { duration_s: 1 })).status).toBe(400);
    expect((await t.api('PATCH', `/api/slides/${slide.id}`, { template: 'nope' })).status).toBe(400);
  });

  it('discards the draft', async () => {
    await t.api('POST', '/api/screens/1/discard');
    const slide = ((await t.api('GET', '/api/screens/1/slides')).json as any[])[1];
    expect(slide.duration_s).toBe(20);
  });

  it('restores an earlier version with one call', async () => {
    const versions = (await t.api('GET', '/api/screens/1/versions')).json as any[];
    expect(versions.length).toBe(2);
    expect(versions[0].note).toBe('Título nuevo');
    const first = versions[versions.length - 1];
    await t.api('POST', `/api/versions/${first.id}/restore`);
    const payload = await player(1);
    expect(payload.slides[1].slots.title).toBe('Menú de Drips');
    expect(payload.screen.theme).toBe('dark');
    expect(((await t.api('GET', '/api/screens/1/versions')).json as any[]).length).toBe(3);
  });

  it('reorders and duplicates slides', async () => {
    const slides = (await t.api('GET', '/api/screens/1/slides')).json as any[];
    const ids = slides.map((s) => s.id).reverse();
    const reordered = (await t.api('POST', '/api/screens/1/slides/reorder', { ids })).json as any[];
    expect(reordered.map((s) => s.id)).toEqual(ids);
    expect((await t.api('POST', '/api/screens/1/slides/reorder', { ids: ids.slice(1) })).status).toBe(400);

    const copy = (await t.api('POST', `/api/slides/${ids[0]}/duplicate`)).json;
    const after = (await t.api('GET', '/api/screens/1/slides')).json as any[];
    expect(after[1].id).toBe(copy.id);
    expect(after).toHaveLength(7);
    await t.api('POST', '/api/screens/1/discard');
  });

  it('duplicates a whole screen and deletes it', async () => {
    const copy = (await t.api('POST', '/api/screens/1/duplicate', { name: 'Recepción' })).json;
    expect(copy).toMatchObject({ name: 'Recepción', slides: 6, dirty: true });
    expect((await player(copy.id, true)).slides).toHaveLength(6);
    expect((await t.api('DELETE', `/api/screens/${copy.id}`)).status).toBe(204);
    expect((await t.api('GET', `/api/screens/${copy.id}/slides`)).status).toBe(404);
  });

  it('an inactive screen shows no slides', async () => {
    await t.api('PATCH', '/api/screens/1', { active: false });
    expect((await player(1)).slides).toEqual([]);
    await t.api('PATCH', '/api/screens/1', { active: true });
    expect((await player(1)).slides).toHaveLength(6);
  });
});

describe('devices (assisted registration)', () => {
  it('registers a new screen and remembers its assignment', async () => {
    const hello = () => t.app.inject({ method: 'POST', url: '/api/devices/hello', payload: { deviceId: 'tv-sala-0001' } });
    expect((await hello()).json()).toEqual({ screen_id: null });
    const devices = (await t.api('GET', '/api/devices')).json as any[];
    expect(devices[0]).toMatchObject({ id: 'tv-sala-0001', online: false, screen_id: null });

    const patched = await t.api('PATCH', '/api/devices/tv-sala-0001', { name: 'Sala de espera', screen_id: 1 });
    expect(patched.json).toMatchObject({ name: 'Sala de espera', screen_id: 1 });
    expect((await hello()).json()).toEqual({ screen_id: 1 });
    expect((await t.api('PATCH', '/api/devices/tv-sala-0001', { screen_id: 999 })).status).toBe(404);
    expect((await t.app.inject({ method: 'POST', url: '/api/devices/hello', payload: { deviceId: '<bad>' } })).statusCode).toBe(400);
  });
});

describe('backups', () => {
  it('creates one copy per day and keeps the last 14', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'drdrip-bk-'));
    try {
      const day = (n: number) => new Date(Date.UTC(2026, 0, n, 12));
      for (let n = 1; n <= 16; n++) expect(ensureDailyBackup(t.ctx.db, dir, day(n))).not.toBeNull();
      expect(ensureDailyBackup(t.ctx.db, dir, day(16))).toBeNull();
      const names = listBackups(dir).map((b) => b.name);
      expect(names).toHaveLength(14);
      expect(names[0]).toBe('drdrip-2026-01-16.db');
      expect(names).not.toContain('drdrip-2026-01-02.db');
      expect(createBackup(t.ctx.db, dir, { manual: true, now: day(17) }).size).toBeGreaterThan(1000);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('network', () => {
  it('prefers the real LAN card over virtual adapters', () => {
    const v4 = (address: string, internal = false) => ({ address, family: 'IPv4', internal, netmask: '', mac: '', cidr: null }) as any;
    const list = lanAddresses({
      'vEthernet (WSL)': [v4('172.20.0.1')],
      Loopback: [v4('127.0.0.1', true)],
      'Wi-Fi': [v4('192.168.1.50'), { ...v4('fe80::1'), family: 'IPv6' }],
      Autoconf: [v4('169.254.3.3')],
    });
    expect(list.map((a) => a.address)).toEqual(['192.168.1.50', '172.20.0.1']);
  });
});

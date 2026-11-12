import { discountPercent } from '@drdrip/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.app.close());

const draft = async (id: number) => (await t.api('GET', `/api/player/${id}?draft=1`)).json;
const addSlide = async (screenId: number, body: unknown) => (await t.api('POST', `/api/screens/${screenId}/slides`, body)).json;

describe('discountPercent', () => {
  it('rounds down and never invents a discount', () => {
    expect(discountPercent(15900, 12900)).toBe(18); // 18.87 % is shown as 18 %
    expect(discountPercent(10000, 5000)).toBe(50);
    expect(discountPercent(10000, 10000)).toBe(0);
    expect(discountPercent(10000, 12000)).toBe(0);
    expect(discountPercent(10000, 0)).toBe(0);
  });
});

describe('offer prices', () => {
  it('stores an offer without touching the regular price', async () => {
    const res = await t.api('PATCH', '/api/services/12', { offer_cents: 12900, offer_ends_at: '2099-12-31' }); // Myers Drip
    expect(res.json).toMatchObject({ name: 'Myers Drip', price_cents: 15900, offer_cents: 12900, offer_label: '', duration_min: 90 });
  });

  it('rejects an offer that is not cheaper, a bad date or a float', async () => {
    expect((await t.api('PATCH', '/api/services/12', { offer_cents: 15900 })).status).toBe(400);
    expect((await t.api('PATCH', '/api/services/12', { offer_cents: 99.5 })).status).toBe(400);
    expect((await t.api('PATCH', '/api/services/12', { offer_ends_at: '31/12/2099' })).status).toBe(400);
    // Lowering the regular price below the offer is refused too, and nothing is saved.
    expect((await t.api('PATCH', '/api/services/12', { price_cents: 10000 })).status).toBe(400);
    const service = ((await t.api('GET', '/api/services')).json as any[]).find((s) => s.id === 12);
    expect(service).toMatchObject({ price_cents: 15900, offer_cents: 12900 });
  });

  it('sends the offer to the screens next to the regular price', async () => {
    const menu = (await t.api('GET', '/api/player/1')).json.slides[1];
    const myers = menu.data.services.find((s: any) => s.name === 'Myers Drip');
    expect(myers.price.text).toBe('$159');
    expect(myers.offer).toEqual({ text: '$129', percent: 18, label: '-18 %', until: 'Hasta el 31 de diciembre' });
    expect(menu.data.services.find((s: any) => s.name === 'Beauty Drip').offer).toBeNull();
  });

  it('uses the custom seal text and ignores expired offers', async () => {
    await t.api('PATCH', '/api/services/12', { offer_label: '2x1' });
    await t.api('PATCH', '/api/services/13', { offer_cents: 9900, offer_ends_at: '2020-01-01' }); // expired
    const services = (await t.api('GET', '/api/player/1')).json.slides[1].data.services;
    expect(services.find((s: any) => s.id === 12).offer.label).toBe('2x1');
    expect(services.find((s: any) => s.id === 13).offer).toBeNull();
  });
});

describe('new slide templates', () => {
  let screenId: number;
  beforeAll(async () => {
    screenId = (await t.api('POST', '/api/screens', { name: 'Ofertas' })).json.id;
  });

  it('the offers slide lists only services with an active offer', async () => {
    const slide = await addSlide(screenId, { template: 'offers' });
    expect(slide.config_json).toMatchObject({ title: 'Ofertas', source: { type: 'offers' } });
    const resolved = (await draft(screenId)).slides[0];
    expect(resolved.empty).toBe(false);
    expect(resolved.data.services.map((s: any) => s.name)).toEqual(['Myers Drip']);

    await t.api('PATCH', '/api/services/12', { offer_cents: 0 });
    expect((await draft(screenId)).slides[0].empty).toBe(true); // falls back to the brand cover
    await t.api('PATCH', '/api/services/12', { offer_cents: 12900 });
  });

  it('product columns accept a category, chosen services or the offers', async () => {
    await addSlide(screenId, { template: 'product-columns', config_json: { columns: 4, source: { type: 'category', categoryId: 3 } } });
    await addSlide(screenId, { template: 'product-columns', config_json: { source: { type: 'offers' } } });
    const slides = (await draft(screenId)).slides;
    expect(slides[1].data.services).toHaveLength(6);
    expect(slides[2].data.services).toHaveLength(1);
  });

  it('the gallery is empty until it has pictures', async () => {
    const slide = await addSlide(screenId, { template: 'gallery' });
    expect((await draft(screenId)).slides[3].empty).toBe(true);
    await t.api('PATCH', `/api/slides/${slide.id}`, { config_json: { ...slide.config_json, images: [{ url: '/media/a.webp', caption: 'Sala' }, { url: '' }] } });
    const resolved = (await draft(screenId)).slides[3];
    expect(resolved.empty).toBe(false);
    expect(resolved.slots.images[0]).toEqual({ url: '/media/a.webp', caption: 'Sala' });
  });

  it('the promotions board shows every promotion that is active today', async () => {
    await addSlide(screenId, { template: 'promos' });
    await t.api('POST', '/api/promos', { title: 'Vitamina C 2x1', subtitle: 'Solo sábados', ends_at: '2099-01-31' });
    await t.api('POST', '/api/promos', { title: 'Vencida', ends_at: '2020-01-01' });
    await t.api('POST', '/api/promos', { title: 'Apagada', active: false });
    const promos = (await draft(screenId)).slides[4].data.promos;
    expect(promos.map((p: any) => p.title).sort()).toEqual(['Gift Cards', 'Vitamina C 2x1']);
    expect(promos.find((p: any) => p.title === 'Vitamina C 2x1').validity).toBe('Válido hasta el 31 de enero de 2099');
  });
});

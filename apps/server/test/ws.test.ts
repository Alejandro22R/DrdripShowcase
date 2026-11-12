import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers.js';

let t: TestApp;
let base: string;

beforeAll(async () => {
  t = await createTestApp();
  await t.app.listen({ port: 0, host: '127.0.0.1' });
  base = `127.0.0.1:${(t.app.server.address() as AddressInfo).port}`;
});
afterAll(() => t.app.close());

/** Opens a player socket and collects what the server pushes. */
async function connect(deviceId: string, screenId: number) {
  const ws = new WebSocket(`ws://${base}/ws`);
  const messages: any[] = [];
  const waiters: (() => void)[] = [];
  ws.addEventListener('message', (ev) => {
    messages.push(JSON.parse(String(ev.data)));
    waiters.splice(0).forEach((w) => w());
  });
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener('open', () => resolve());
    ws.addEventListener('error', () => reject(new Error('ws error')));
  });
  ws.send(JSON.stringify({ type: 'hello', deviceId, screenId }));
  const next = async (type: string) => {
    for (let i = 0; i < 40; i++) {
      const index = messages.findIndex((m) => m.type === type);
      if (index >= 0) return messages.splice(index, 1)[0];
      await new Promise<void>((resolve) => {
        waiters.push(resolve);
        setTimeout(resolve, 100);
      });
    }
    throw new Error(`No "${type}" message arrived`);
  };
  return { ws, next, messages };
}

describe('WebSocket', () => {
  it('registers the device, pushes updates and assignments', async () => {
    const tv = await connect('tv-recepcion-01', 1);
    expect(await tv.next('hello')).toEqual({ type: 'hello', screenId: null });

    const devices = (await t.api('GET', '/api/devices')).json as any[];
    expect(devices[0]).toMatchObject({ id: 'tv-recepcion-01', online: true, showing_screen_id: 1 });
    expect(((await t.api('GET', '/api/screens')).json as any[])[0].online).toBe(1);

    await t.api('PATCH', '/api/services/2', { price_cents: 7000 });
    expect(await tv.next('update')).toEqual({ type: 'update' });

    await t.api('POST', '/api/screens/1/publish');
    expect(await tv.next('update')).toEqual({ type: 'update' });

    const other = (await t.api('POST', '/api/screens', { name: 'Recepción' })).json;
    await t.api('PATCH', '/api/devices/tv-recepcion-01', { screen_id: other.id });
    expect(await tv.next('assign')).toEqual({ type: 'assign', screenId: other.id });

    await t.api('POST', '/api/devices/tv-recepcion-01/reload');
    expect(await tv.next('reload')).toEqual({ type: 'reload' });

    tv.ws.close();
    await new Promise((r) => setTimeout(r, 150));
    expect(((await t.api('GET', '/api/devices')).json as any[])[0].online).toBe(false);
  });

  it('only notifies the screen that was published', async () => {
    const a = await connect('tv-a-000001', 1);
    const b = await connect('tv-b-000001', 2);
    await a.next('hello');
    await b.next('hello');
    await t.api('POST', '/api/screens/2/publish');
    expect(await b.next('update')).toEqual({ type: 'update' });
    expect(a.messages).toEqual([]);
    a.ws.close();
    b.ws.close();
  });
});

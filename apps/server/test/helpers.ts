import type { FastifyInstance } from 'fastify';
import { buildApp, type BuiltApp } from '../src/app.js';
import type { AppConfig } from '../src/config.js';

export interface TestApp extends BuiltApp {
  token: string;
  api: (method: string, url: string, body?: unknown, headers?: Record<string, string>) => Promise<{ status: number; json: any; text: string }>;
}

export async function createTestApp(overrides: Partial<AppConfig> = {}): Promise<TestApp> {
  const built = await buildApp({ memoryDb: true, logger: false, mdns: false, ...overrides });
  const login = await built.app.inject({ method: 'POST', url: '/api/auth/login', payload: { pin: '1234' } });
  const token = login.json().token as string;
  const api: TestApp['api'] = async (method, url, body, headers = {}) => {
    const res = await (built.app as FastifyInstance).inject({
      method: method as 'GET',
      url,
      payload: body as object | undefined,
      headers: { authorization: `Bearer ${token}`, ...headers },
    });
    let json: unknown = null;
    try {
      json = res.json();
    } catch {
      /* not JSON */
    }
    return { status: res.statusCode, json, text: res.body };
  };
  return { ...built, token, api };
}

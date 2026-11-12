import type { WebSocket } from 'ws';
import type { Db } from '../db/db.js';

export interface Client {
  socket: WebSocket;
  deviceId: string;
  screenId: number | null;
  preview: boolean;
  ip: string;
  connectedAt: number;
}

export type ServerMessage =
  | { type: 'update' }
  | { type: 'assign'; screenId: number }
  | { type: 'reload' }
  | { type: 'hello'; screenId: number | null };

/** Tracks connected players and pushes real-time notices to them. */
export class Hub {
  private clients = new Set<Client>();

  constructor(private db: Db) {}

  add(socket: WebSocket, ip: string, userAgent: string): void {
    const client: Client = { socket, deviceId: '', screenId: null, preview: false, ip, connectedAt: Date.now() };
    this.clients.add(client);

    socket.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (msg.type !== 'hello') return;
      client.deviceId = typeof msg.deviceId === 'string' ? msg.deviceId.slice(0, 64) : '';
      client.screenId = typeof msg.screenId === 'number' && Number.isInteger(msg.screenId) ? msg.screenId : null;
      client.preview = msg.preview === true;
      if (client.deviceId && !client.preview) {
        const assigned = this.touchDevice(client.deviceId, ip, userAgent);
        this.send(client, { type: 'hello', screenId: assigned });
      }
    });
    socket.on('close', () => this.clients.delete(client));
    socket.on('error', () => this.clients.delete(client));
  }

  /** Registers a device the first time it shows up and returns its assigned screen. */
  touchDevice(deviceId: string, ip: string, userAgent: string): number | null {
    this.db.run(
      `INSERT INTO devices (id, ip, user_agent) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET ip = excluded.ip, user_agent = excluded.user_agent, last_seen = datetime('now')`,
      deviceId,
      ip,
      userAgent.slice(0, 300),
    );
    return this.db.get<{ screen_id: number | null }>('SELECT screen_id FROM devices WHERE id = ?', deviceId)?.screen_id ?? null;
  }

  private send(client: Client, msg: ServerMessage): void {
    if (client.socket.readyState === 1) client.socket.send(JSON.stringify(msg));
  }

  /** Tells players to fetch their configuration again. */
  notifyUpdate(screenId?: number): void {
    for (const client of this.clients) {
      if (screenId === undefined || client.screenId === screenId) this.send(client, { type: 'update' });
    }
  }

  sendToDevice(deviceId: string, msg: ServerMessage): number {
    let sent = 0;
    for (const client of this.clients) {
      if (client.deviceId === deviceId && !client.preview) {
        this.send(client, msg);
        sent++;
      }
    }
    return sent;
  }

  /** Live players, without admin previews. */
  online(): { deviceId: string; screenId: number | null; ip: string; connectedAt: number }[] {
    return [...this.clients]
      .filter((c) => c.deviceId && !c.preview)
      .map(({ deviceId, screenId, ip, connectedAt }) => ({ deviceId, screenId, ip, connectedAt }));
  }

  closeAll(): void {
    for (const client of this.clients) client.socket.terminate();
    this.clients.clear();
  }
}

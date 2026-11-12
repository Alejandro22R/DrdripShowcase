import os from 'node:os';

export interface LanAddress {
  name: string;
  address: string;
}

const VIRTUAL = /(virtual|vmware|vbox|hyper-v|vethernet|docker|wsl|loopback|tailscale|zerotier|bluetooth|tun|tap|utun|br-)/i;

function isPrivate(ip: string): boolean {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
}

/**
 * LAN IPv4 addresses, best candidate first: real network cards with private
 * addresses come before virtual adapters, so TVs get an address they can reach.
 */
export function lanAddresses(interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = os.networkInterfaces()): LanAddress[] {
  const found: (LanAddress & { score: number })[] = [];
  for (const [name, list] of Object.entries(interfaces)) {
    for (const info of list ?? []) {
      if (info.family !== 'IPv4' || info.internal || info.address.startsWith('169.254.')) continue;
      const score = (isPrivate(info.address) ? 2 : 0) + (VIRTUAL.test(name) ? 0 : 1);
      found.push({ name, address: info.address, score });
    }
  }
  return found.sort((a, b) => b.score - a.score).map(({ name, address }) => ({ name, address }));
}

/** Announces `<name>.local` on the network. Returns a function that stops it. */
export async function startMdns(name: string, port: number, log: (msg: string) => void): Promise<() => void> {
  try {
    const { Bonjour } = await import('bonjour-service');
    const bonjour = new Bonjour(undefined, (err: unknown) => log(`mDNS: ${String(err)}`));
    const service = bonjour.publish({ name: 'DrDrip Vitrina', type: 'http', port, host: `${name}.local`, txt: { path: '/' } });
    service.on('error', (err: unknown) => log(`mDNS: ${String(err)}`));
    return () => {
      try {
        bonjour.unpublishAll(() => bonjour.destroy());
      } catch {
        /* ignore */
      }
    };
  } catch (err) {
    log(`mDNS no disponible: ${String(err)}`);
    return () => {};
  }
}

// Descobre quais redes locais (privadas) o computador usa, para procurar TVs só nelas.
import os from 'node:os';

export interface LocalNetwork {
  interfaceName: string;
  address: string;
  /** Prefixo /24 a ser varrido, ex.: "192.168.0" */
  prefix24: string;
  virtual: boolean;
}

export type InterfaceMap = Record<string, os.NetworkInterfaceInfo[] | undefined>;

const VIRTUAL = /vethernet|virtualbox|vbox|vmware|vmnet|hyper-v|wsl|docker|br-|veth|tailscale|zerotier|loopback|npcap/i;

export function isPrivateIPv4(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = p as [number, number, number, number];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** Redes privadas do computador; adaptadores reais primeiro; no máximo `max` redes /24 distintas. */
export function localNetworks(interfaces: InterfaceMap = os.networkInterfaces(), max = 4): LocalNetwork[] {
  const found: LocalNetwork[] = [];
  for (const [name, infos] of Object.entries(interfaces)) {
    for (const info of infos ?? []) {
      const family = String(info.family);
      if ((family !== 'IPv4' && family !== '4') || info.internal || !isPrivateIPv4(info.address)) continue;
      const prefix24 = info.address.split('.').slice(0, 3).join('.');
      found.push({ interfaceName: name, address: info.address, prefix24, virtual: VIRTUAL.test(name) });
    }
  }
  found.sort((a, b) => Number(a.virtual) - Number(b.virtual));
  const seen = new Set<string>();
  return found.filter((n) => !seen.has(n.prefix24) && seen.add(n.prefix24)).slice(0, max);
}

/** Endereços .1 a .254 de uma rede /24, menos o próprio computador. */
export function hostsOf(net: LocalNetwork): string[] {
  const hosts: string[] = [];
  for (let i = 1; i <= 254; i++) {
    const ip = `${net.prefix24}.${i}`;
    if (ip !== net.address) hosts.push(ip);
  }
  return hosts;
}

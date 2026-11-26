import { hostsOf, localNetworks, type InterfaceMap, type LocalNetwork } from './networks.ts';
import { type MdnsBrowser, type MdnsDevice, udpMdnsBrowser } from './mdns.ts';
import { mapLimit, type PortProber, tcpProbe } from './probe.ts';

export interface DiscoveredTv {
  host: string;
  /** Nome amigável que a TV anuncia (ex.: "TV da Sala"), se houver. */
  name: string | null;
  model: string | null;
  /** Porta para conectar se a depuração estiver ligada; null se não detectada. */
  adbPort: number | null;
  debuggingEnabled: boolean;
  sources: ('cast' | 'adb-tls' | 'port-5555')[];
}

export interface DiscoverOptions {
  interfaces?: InterfaceMap;
  prober?: PortProber;
  mdns?: MdnsBrowser;
  probeTimeoutMs?: number;
  mdnsTimeoutMs?: number;
  concurrency?: number;
}

export interface DiscoveryResult {
  networks: LocalNetwork[];
  tvs: DiscoveredTv[];
  durationMs: number;
}

/**
 * Procura TVs na rede local. SOMENTE LEITURA: consultas mDNS e testes de porta (abre e fecha).
 * Nenhum comando ADB é enviado e nenhuma TV recebe aviso de autorização.
 */
export async function discoverTvs(options: DiscoverOptions = {}): Promise<DiscoveryResult> {
  const started = Date.now();
  const networks = localNetworks(options.interfaces);
  const prober = options.prober ?? tcpProbe;
  const mdns = options.mdns ?? udpMdnsBrowser;

  const hosts = networks.flatMap(hostsOf);
  const [mdnsDevices, open5555] = await Promise.all([
    mdns(networks.map((n) => n.address), options.mdnsTimeoutMs ?? 1500).catch(() => [] as MdnsDevice[]),
    mapLimit(hosts, options.concurrency ?? 64, async (h) => ((await prober(h, 5555, options.probeTimeoutMs ?? 400)) ? h : null)),
  ]);

  const inLocalNets = (ip: string) => networks.some((n) => ip.startsWith(n.prefix24 + '.'));
  const byHost = new Map<string, DiscoveredTv>();
  const get = (host: string) => {
    let tv = byHost.get(host);
    if (!tv) {
      tv = { host, name: null, model: null, adbPort: null, debuggingEnabled: false, sources: [] };
      byHost.set(host, tv);
    }
    return tv;
  };

  for (const d of mdnsDevices) {
    if (!inLocalNets(d.host)) continue;
    if (d.service === 'cast') {
      if (!hasVideoOutput(d.txt)) continue; // alto-falantes e grupos de som
      const tv = get(d.host);
      tv.name ??= d.txt.fn || null;
      tv.model ??= d.txt.md || null;
      if (!tv.sources.includes('cast')) tv.sources.push('cast');
    } else {
      const tv = get(d.host);
      tv.adbPort = d.port ?? tv.adbPort;
      tv.debuggingEnabled = tv.adbPort !== null;
      if (!tv.sources.includes('adb-tls')) tv.sources.push('adb-tls');
    }
  }
  for (const h of open5555) {
    if (!h) continue;
    const tv = get(h);
    tv.adbPort = 5555; // porta clássica tem prioridade: conecta sem pareamento
    tv.debuggingEnabled = true;
    tv.sources.push('port-5555');
  }

  const tvs = [...byHost.values()].sort(
    (a, b) => Number(b.debuggingEnabled) - Number(a.debuggingEnabled) || Number(!!b.name) - Number(!!a.name) || ipOrder(a.host) - ipOrder(b.host),
  );
  return { networks, tvs, durationMs: Date.now() - started };
}

/**
 * Bit 0 de "ca" (capabilities do Cast) = saída de vídeo; bit 5 = grupo multi-room.
 * Sem "ca", na dúvida, mantém.
 */
export function hasVideoOutput(txt: Record<string, string>): boolean {
  if (txt.ca === undefined) return true;
  const ca = Number(txt.ca);
  if (!Number.isFinite(ca)) return true;
  return (ca & 1) === 1 && (ca & 32) === 0;
}

function ipOrder(ip: string): number {
  return ip.split('.').reduce((acc, n) => acc * 256 + Number(n), 0);
}

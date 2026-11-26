// Consulta mDNS "legacy unicast" (RFC 6762 §6.7): perguntamos de uma porta qualquer e as TVs respondem
// direto para nós. Assim não é preciso abrir a porta 5353 nem mexer no firewall do Windows.
import dgram from 'node:dgram';
import dnsPacket from 'dns-packet';

export const SERVICES = {
  cast: '_googlecast._tcp.local',
  adbTls: '_adb-tls-connect._tcp.local',
} as const;

export interface MdnsDevice {
  service: 'cast' | 'adbTls';
  host: string;
  port: number | null;
  instance: string;
  txt: Record<string, string>;
}

export type MdnsBrowser = (localAddresses: string[], timeoutMs: number) => Promise<MdnsDevice[]>;

type Answer = dnsPacket.Answer;

/** Interpreta as respostas mDNS (função pura, testável). `from` é o IP de quem respondeu. */
export function parseMdnsResponse(packet: dnsPacket.Packet, from: string): MdnsDevice[] {
  const records: Answer[] = [...(packet.answers ?? []), ...(packet.additionals ?? [])];
  const srv = new Map<string, { target: string; port: number }>();
  const txt = new Map<string, Record<string, string>>();
  const a = new Map<string, string>();
  for (const r of records) {
    if (r.type === 'SRV') srv.set(r.name, { target: (r.data as { target: string }).target, port: (r.data as { port: number }).port });
    if (r.type === 'TXT') txt.set(r.name, decodeTxt(r.data as unknown));
    if (r.type === 'A') a.set(r.name, r.data as string);
  }
  const out: MdnsDevice[] = [];
  for (const r of records) {
    if (r.type !== 'PTR') continue;
    const service = r.name === SERVICES.cast ? 'cast' : r.name === SERVICES.adbTls ? 'adbTls' : null;
    if (!service) continue;
    const instance = r.data as string;
    const s = srv.get(instance);
    const host = (s && a.get(s.target)) || from;
    out.push({ service, host, port: s?.port ?? null, instance, txt: txt.get(instance) ?? {} });
  }
  return out;
}

function decodeTxt(data: unknown): Record<string, string> {
  const items = Array.isArray(data) ? data : [data];
  const out: Record<string, string> = {};
  for (const item of items) {
    const s = Buffer.isBuffer(item) ? item.toString('utf8') : String(item ?? '');
    const i = s.indexOf('=');
    if (i > 0) out[s.slice(0, i).toLowerCase()] = s.slice(i + 1);
  }
  return out;
}

/** Envia a pergunta por cada rede local e junta as respostas durante `timeoutMs`. */
export const udpMdnsBrowser: MdnsBrowser = async (localAddresses, timeoutMs) => {
  const query = dnsPacket.encode({
    type: 'query',
    id: 0,
    questions: [
      { type: 'PTR', name: SERVICES.cast },
      { type: 'PTR', name: SERVICES.adbTls },
    ],
  });
  const results: MdnsDevice[] = [];
  const sockets = await Promise.all(
    localAddresses.map(
      (address) =>
        new Promise<dgram.Socket | null>((resolve) => {
          const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
          sock.on('error', () => {
            sock.close();
            resolve(null);
          });
          sock.on('message', (msg, rinfo) => {
            try {
              results.push(...parseMdnsResponse(dnsPacket.decode(msg), rinfo.address));
            } catch {
              /* pacote estranho: ignora */
            }
          });
          sock.bind(0, address, () => {
            try {
              sock.setMulticastInterface(address);
              sock.send(query, 5353, '224.0.0.251');
              // repete uma vez: mDNS usa UDP e pacotes se perdem
              setTimeout(() => sock.send(query, 5353, '224.0.0.251', () => undefined), 300);
              resolve(sock);
            } catch {
              sock.close();
              resolve(null);
            }
          });
        }),
    ),
  );
  await new Promise((r) => setTimeout(r, timeoutMs));
  for (const s of sockets) s?.close();
  return results;
};

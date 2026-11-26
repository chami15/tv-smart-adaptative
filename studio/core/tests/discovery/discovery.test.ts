import net from 'node:net';
import dnsPacket from 'dns-packet';
import { describe, expect, it } from 'vitest';
import {
  discoverTvs,
  hasVideoOutput,
  hostsOf,
  isPrivateIPv4,
  localNetworks,
  type MdnsDevice,
  parseMdnsResponse,
  tcpProbe,
} from '../../src/discovery/index.ts';

const iface = (address: string, internal = false) => ({
  address, netmask: '255.255.255.0', family: 'IPv4' as const, mac: '00:00:00:00:00:00', internal, cidr: `${address}/24`,
});

// Placas típicas de um PC com Windows
const WINDOWS = {
  'vEthernet (WSL)': [iface('172.24.160.1')],
  'Wi-Fi': [iface('192.168.0.12')],
  'Loopback Pseudo-Interface 1': [iface('127.0.0.1', true)],
  'Ethernet 2': [iface('169.254.10.2')],
  'VirtualBox Host-Only Network': [iface('192.168.56.1')],
};

describe('redes locais', () => {
  it('só redes privadas, adaptador real primeiro', () => {
    const nets = localNetworks(WINDOWS);
    expect(nets.map((n) => n.prefix24)).toEqual(['192.168.0', '172.24.160', '192.168.56']);
    expect(nets[0]).toMatchObject({ interfaceName: 'Wi-Fi', virtual: false });
  });

  it('limita a quantidade de redes e ignora repetidas', () => {
    const many = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`eth${i}`, [iface(`10.0.${i}.5`)]]));
    many.dup = [iface('10.0.0.9')];
    expect(localNetworks(many, 4)).toHaveLength(4);
  });

  it('IPs privados', () => {
    expect(isPrivateIPv4('192.168.1.1')).toBe(true);
    expect(isPrivateIPv4('172.31.0.1')).toBe(true);
    expect(isPrivateIPv4('172.32.0.1')).toBe(false);
    expect(isPrivateIPv4('8.8.8.8')).toBe(false);
    expect(isPrivateIPv4('169.254.1.1')).toBe(false);
  });

  it('hostsOf: 253 endereços, sem o próprio PC', () => {
    const h = hostsOf({ interfaceName: 'x', address: '192.168.0.12', prefix24: '192.168.0', virtual: false });
    expect(h).toHaveLength(253);
    expect(h).not.toContain('192.168.0.12');
    expect(h[0]).toBe('192.168.0.1');
  });
});

describe('mDNS', () => {
  it('lê nome, modelo e IP de um anúncio Chromecast/Google TV', () => {
    const packet = dnsPacket.decode(
      dnsPacket.encode({
        type: 'response',
        answers: [{ type: 'PTR', name: '_googlecast._tcp.local', data: 'TV-abc._googlecast._tcp.local' }],
        additionals: [
          { type: 'SRV', name: 'TV-abc._googlecast._tcp.local', data: { target: 'abc.local', port: 8009 } },
          { type: 'TXT', name: 'TV-abc._googlecast._tcp.local', data: ['id=abc', 'fn=TV da Sala', 'md=Smart TV Pro', 'ca=463365'] },
          { type: 'A', name: 'abc.local', data: '192.168.0.25' },
        ],
      }),
    );
    expect(parseMdnsResponse(packet, '192.168.0.25')).toEqual([
      {
        service: 'cast', host: '192.168.0.25', port: 8009, instance: 'TV-abc._googlecast._tcp.local',
        txt: { id: 'abc', fn: 'TV da Sala', md: 'Smart TV Pro', ca: '463365' },
      },
    ]);
  });

  it('lê a porta da Depuração por Wi-Fi e usa o IP de quem respondeu se faltar registro A', () => {
    const packet = dnsPacket.decode(
      dnsPacket.encode({
        type: 'response',
        answers: [
          { type: 'PTR', name: '_adb-tls-connect._tcp.local', data: 'adb-X._adb-tls-connect._tcp.local' },
          { type: 'SRV', name: 'adb-X._adb-tls-connect._tcp.local', data: { target: 'x.local', port: 41234 } },
        ],
      }),
    );
    expect(parseMdnsResponse(packet, '192.168.0.30')[0]).toMatchObject({ service: 'adbTls', host: '192.168.0.30', port: 41234 });
  });

  it('filtra alto-falantes e grupos (sem saída de vídeo)', () => {
    expect(hasVideoOutput({ ca: '463365' })).toBe(true); // TV/Chromecast (bit 0)
    expect(hasVideoOutput({ ca: '199172' })).toBe(false); // alto-falante (sem bit 0)
    expect(hasVideoOutput({ ca: '4129' })).toBe(false); // grupo multi-room (bit 5)
    expect(hasVideoOutput({})).toBe(true);
  });
});

describe('discoverTvs', () => {
  const tvCast = (host: string, fn: string, ca = '463365'): MdnsDevice => ({
    service: 'cast', host, port: 8009, instance: fn, txt: { fn, md: 'Modelo', ca },
  });

  it('junta anúncios e porta 5555; TVs prontas primeiro; ignora IPs fora da rede e alto-falantes', async () => {
    const r = await discoverTvs({
      interfaces: { 'Wi-Fi': [iface('192.168.0.12')] },
      prober: async (h) => h === '192.168.0.25' || h === '192.168.0.80',
      mdns: async () => [
        tvCast('192.168.0.25', 'TV da Sala'),
        tvCast('192.168.0.40', 'TV do Quarto'),
        tvCast('192.168.0.41', 'Caixa de som', '199172'),
        tvCast('10.9.9.9', 'Outra rede'),
        { service: 'adbTls', host: '192.168.0.40', port: 41234, instance: 'x', txt: {} },
      ],
    });
    expect(r.tvs.map((t) => [t.host, t.name, t.adbPort, t.debuggingEnabled])).toEqual([
      ['192.168.0.25', 'TV da Sala', 5555, true],
      ['192.168.0.40', 'TV do Quarto', 41234, true],
      ['192.168.0.80', null, 5555, true],
    ]);
  });

  it('TV anunciada sem depuração ligada aparece como "depuração desligada"', async () => {
    const r = await discoverTvs({
      interfaces: { 'Wi-Fi': [iface('192.168.0.12')] },
      prober: async () => false,
      mdns: async () => [tvCast('192.168.0.25', 'TV da Sala')],
    });
    expect(r.tvs).toEqual([
      { host: '192.168.0.25', name: 'TV da Sala', model: 'Modelo', adbPort: null, debuggingEnabled: false, sources: ['cast'] },
    ]);
  });

  it('falha no mDNS não derruba a busca; sem rede privada → nada é varrido', async () => {
    let probes = 0;
    const r = await discoverTvs({
      interfaces: { eth: [iface('8.8.4.4')] },
      prober: async () => (probes++, false),
      mdns: async () => {
        throw new Error('sem permissão');
      },
    });
    expect(r.networks).toEqual([]);
    expect(r.tvs).toEqual([]);
    expect(probes).toBe(0);
  });
});

describe('tcpProbe (de verdade, na própria máquina)', () => {
  it('porta aberta → true; fechada → false; não envia dados', async () => {
    let received = 0;
    const server = net.createServer((s) => s.on('data', (d) => (received += d.length)));
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const port = (server.address() as net.AddressInfo).port;
    expect(await tcpProbe('127.0.0.1', port, 500)).toBe(true);
    await new Promise<void>((r) => server.close(() => r()));
    expect(await tcpProbe('127.0.0.1', port, 500)).toBe(false);
    expect(received).toBe(0);
  });
});

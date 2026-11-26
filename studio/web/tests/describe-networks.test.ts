// Relato do usuário (2026-11-26): a linha listava 4 redes (VirtualBox, WSL…) além da rede da TV.
import { expect, it } from 'vitest';
import { describeNetworks } from '../src/components/NearbyTvs.tsx';

const net = (prefix24: string) => ({ interfaceName: 'x', address: `${prefix24}.10`, prefix24 });
const tv = (host: string) => ({ host, name: 'bebe tele', model: 'Smart TV', adbPort: 5555, debuggingEnabled: true, sources: [] });

it('mostra só a rede onde a TV está', () => {
  const r = { networks: ['192.168.56', '192.168.0', '172.23.128', '172.30.112'].map(net), tvs: [tv('192.168.0.128')], durationMs: 1 };
  expect(describeNetworks(r)).toBe('1 aparelho na rede 192.168.0.x');
});

it('sem TVs: diz quantas redes foram verificadas', () => {
  expect(describeNetworks({ networks: [net('192.168.0'), net('172.23.128')], tvs: [], durationMs: 1 })).toBe(
    'Nenhum aparelho encontrado (2 redes verificadas).',
  );
});

it('sem rede de casa', () => {
  expect(describeNetworks({ networks: [], tvs: [], durationMs: 1 })).toMatch(/não parece estar numa rede de casa/);
});

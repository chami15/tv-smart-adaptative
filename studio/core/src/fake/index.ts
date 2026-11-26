import fs from 'node:fs';
import type { DiscoveryResult } from '../discovery/discover.ts';
import { FakeTvWorld, type FakeWorldOptions } from './world.ts';
import type { FakeDeviceSpec } from './types.ts';

export * from './types.ts';
export * from './world.ts';

const DIR = new URL('./devices/', import.meta.url);

/** Carrega todos os aparelhos simulados de `fake/devices/*.json`. */
export function loadFakeDevices(): Map<string, FakeDeviceSpec> {
  const map = new Map<string, FakeDeviceSpec>();
  for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()) {
    const spec = JSON.parse(fs.readFileSync(new URL(file, DIR), 'utf8')) as FakeDeviceSpec;
    map.set(spec.id, spec);
  }
  return map;
}

export function loadFakeDevice(id: string): FakeDeviceSpec {
  const spec = loadFakeDevices().get(id);
  if (!spec) throw new Error(`aparelho simulado inexistente: ${id}`);
  return structuredClone(spec);
}

/** Endereços da rede simulada usada no modo de demonstração e nos testes ponta a ponta. */
export const FAKE_NETWORK: readonly { host: string; device: string; scenario: string; behavior?: FakeDeviceSpec['behavior'] }[] = [
  { host: '192.168.0.50', device: 'tcl-googletv-2gb', scenario: 'TCL Google TV (pede autorização na TV)' },
  { host: '192.168.0.51', device: 'philips-androidtv-9', scenario: 'Philips Android TV 9' },
  { host: '192.168.0.52', device: 'xiaomi-mibox', scenario: 'Xiaomi Mi Box S' },
  { host: '192.168.0.53', device: 'sony-googletv-4k', scenario: 'Sony Google TV' },
  { host: '192.168.0.54', device: 'generic-aosp-box', scenario: 'TV box genérica (sem Google)' },
  { host: '192.168.0.55', device: 'amazon-firetv', scenario: 'Fire TV (ainda não suportada)' },
  { host: '192.168.0.56', device: 'android-phone', scenario: 'Celular (não é TV)' },
  { host: '192.168.0.60', device: 'tcl-googletv-2gb', scenario: 'Usuário não aceita na TV', behavior: { auth: 'never' } },
  { host: '192.168.0.61', device: 'tcl-googletv-2gb', scenario: 'Depuração desligada', behavior: { refuseConnection: true } },
  { host: '192.168.0.62', device: 'tcl-googletv-2gb', scenario: 'TV não responde (tempo esgotado)', behavior: { timeout: true } },
  { host: '192.168.0.63', device: 'tcl-googletv-2gb', scenario: 'Rede cai no meio da leitura', behavior: { auth: 'accept', acceptAfterPolls: 0, dropAfterCommands: 3 } },
  { host: '192.168.0.64', device: 'tcl-googletv-2gb', scenario: 'Respostas corrompidas', behavior: { auth: 'accept', acceptAfterPolls: 0, garbage: true } },
];

export function createFakeNetwork(options?: FakeWorldOptions): FakeTvWorld {
  const devices = loadFakeDevices();
  const world = new FakeTvWorld(options);
  for (const entry of FAKE_NETWORK) {
    const spec = devices.get(entry.device);
    if (spec) world.addTv(entry.host, structuredClone(spec), entry.behavior);
  }
  return world;
}
export * from './export.ts';

/** Nomes amigáveis que as TVs simuladas "anunciam" na rede. */
const FAKE_NAMES: Record<string, string> = {
  '192.168.0.50': 'TV da Sala',
  '192.168.0.51': 'TV do Quarto',
  '192.168.0.52': 'Mi Box da Cozinha',
  '192.168.0.53': 'Bravia do Escritório',
};

/** Resultado de busca na rede simulada (modo demonstração e testes). */
export function fakeDiscovery(): DiscoveryResult {
  const devices = loadFakeDevices();
  const tvs: DiscoveryResult['tvs'] = FAKE_NETWORK.filter((e) => e.device !== 'android-phone').map((e) => {
    const off = Boolean(e.behavior?.refuseConnection);
    return {
      host: e.host,
      name: FAKE_NAMES[e.host] ?? null,
      model: devices.get(e.device)?.props['ro.product.model'] ?? null,
      adbPort: off ? null : 5555,
      debuggingEnabled: !off,
      sources: off ? ['cast'] : ['cast', 'port-5555'],
    };
  });
  // uma TV que anuncia o nome, mas está com a depuração desligada
  tvs.push({ host: '192.168.0.70', name: 'TV da Varanda', model: 'Smart TV', adbPort: null, debuggingEnabled: false, sources: ['cast'] });
  tvs.sort((a, b) => Number(b.debuggingEnabled) - Number(a.debuggingEnabled) || Number(!!b.name) - Number(!!a.name));
  return {
    networks: [{ interfaceName: 'Wi-Fi (simulado)', address: '192.168.0.10', prefix24: '192.168.0', virtual: false }],
    tvs,
    durationMs: 900,
  };
}

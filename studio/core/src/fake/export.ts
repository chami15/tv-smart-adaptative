// Converte um inventário real em aparelho simulado ANÔNIMO, para virar caso de teste.
// Só é usado com consentimento do dono da TV.
//  - sem serial, hostname, IP (o inventário já não guarda);
//  - apps instalados pelo usuário viram nomes genéricos (revelariam hábitos);
//  - apps de sistema são mantidos (são iguais em todas as TVs do mesmo modelo).
import type { DeviceInventory } from '../inventory/collect.ts';
import { SAFE_PROPS } from '../inventory/collect.ts';
import type { FakeDeviceSpec } from './types.ts';

export function inventoryToFixture(inv: DeviceInventory, id: string): FakeDeviceSpec {
  const rename = new Map<string, string>();
  let n = 0;
  for (const p of inv.packages) if (!p.system) rename.set(p.name, `com.usuario.app${++n}`);
  const anon = (name: string) => rename.get(name) ?? name;

  const props: Record<string, string> = {};
  for (const key of SAFE_PROPS) if (inv.props[key] !== undefined) props[key] = inv.props[key]!;
  props['ro.serialno'] = 'SIMULADO-REAL';

  // Backups antigos não tinham "features": reconstrói o mínimo a partir do que já foi detectado.
  const features = inv.features ?? (inv.device.platform === 'google-tv' || inv.device.platform === 'android-tv' || inv.device.platform === 'fire-os'
    ? ['android.software.leanback', 'android.hardware.type.television']
    : []);

  const totalKb = inv.memory.totalKb ?? 0;
  const availableKb = inv.memory.availableKb ?? 0;
  return {
    id,
    description: `${inv.device.brand} ${inv.device.model} — exportado de uma TV real (anonimizado)`,
    simulated: true,
    props,
    features: features.map((f) => `feature:${f}`),
    packages: inv.packages.map((p) => ({ name: anon(p.name), system: p.system, enabled: p.enabled })),
    memory: { totalKb, availableKb, freeKb: Math.round(availableKb * 0.4) },
    processes: inv.processes.map((p) => ({ name: anon(p.name), pssKb: p.kb })),
    display: { width: inv.display.width ?? 1920, height: inv.display.height ?? 1080, density: inv.display.density ?? 320 },
    home: inv.currentHome ? `${inv.currentHome.package}/${inv.currentHome.activity}` : null,
  };
}

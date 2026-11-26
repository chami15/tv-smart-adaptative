// Restaurar a partir de um backup: calcula a diferença backup × agora e vira um plano revisável.
import type { Catalog } from '../catalog/index.ts';
import type { DeviceInventory } from '../inventory/collect.ts';
import { buildPlan, type ChangePlan, type Rejection } from './plan.ts';

export function buildRestorePlan(args: {
  snapshot: DeviceInventory;
  current: DeviceInventory;
  serial: string;
  catalog: Catalog;
  snapshotDir: string;
  snapshotDate: string;
}): { plan: ChangePlan | null; rejected: Rejection[]; error?: string } {
  const { snapshot, current } = args;
  if (snapshot.deviceId !== current.deviceId) return { plan: null, rejected: [], error: 'Este backup é de outra TV.' };
  const was = new Map(snapshot.packages.map((p) => [p.name, p.enabled]));
  const enable: string[] = [];
  const disable: string[] = [];
  for (const p of current.packages) {
    const before = was.get(p.name);
    if (before === undefined || before === p.enabled) continue; // app novo ou igual: não mexe
    (before ? enable : disable).push(p.name);
  }
  const { plan, rejected } = buildPlan({
    inventory: current,
    serial: args.serial,
    catalog: args.catalog,
    request: { enable, disable },
    kind: 'restore',
    title: `Voltar a TV como estava em ${new Date(args.snapshotDate).toLocaleString('pt-BR')}`,
    basedOnSnapshot: args.snapshotDir,
  });
  return { plan, rejected };
}

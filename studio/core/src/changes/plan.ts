// Plano de mudanças: o que exatamente será feito, em português, com como desfazer.
// O hash garante que o plano executado é o mesmo que o usuário viu.
import { createHash, randomUUID } from 'node:crypto';
import { type Catalog, classifyPackage, type DeviceContext, type SafetyLevel } from '../catalog/index.ts';
import type { DeviceInventory } from '../inventory/collect.ts';

export const MAX_ACTIONS = 80;

export type ActionKind = 'disable' | 'enable';

export interface PlanAction {
  kind: ActionKind;
  pkg: string;
  label: string;
  level: SafetyLevel;
  effect?: string;
  /** Memória que o app usava na última leitura (kB), se conhecida. */
  estimatedKb: number | null;
}

export interface ChangePlan {
  schemaVersion: 1;
  id: string;
  kind: 'cleanup' | 'restore' | 'undo';
  title: string;
  serial: string;
  deviceId: string;
  createdAt: string;
  actions: PlanAction[];
  hash: string;
  /** Backup que originou um plano de restauração. */
  basedOnSnapshot?: string;
}

export interface Rejection {
  pkg: string;
  reason: string;
}

export interface PlanRequest {
  disable?: string[];
  enable?: string[];
}

export function deviceContext(inv: DeviceInventory): DeviceContext {
  return {
    brand: inv.device.brand,
    manufacturer: inv.device.manufacturer,
    model: inv.device.model,
    currentHome: inv.currentHome?.package ?? null,
  };
}

export function hashPlan(p: Pick<ChangePlan, 'serial' | 'deviceId' | 'actions'>): string {
  const canonical = JSON.stringify({ serial: p.serial, deviceId: p.deviceId, actions: p.actions.map((a) => [a.kind, a.pkg]) });
  return createHash('sha256').update(canonical).digest('hex');
}

/** Confere cada pedido contra o estado atual da TV e o catálogo. Nunca lança: devolve plano + recusas. */
export function buildPlan(args: {
  inventory: DeviceInventory;
  serial: string;
  catalog: Catalog;
  request: PlanRequest;
  kind?: ChangePlan['kind'];
  title?: string;
  basedOnSnapshot?: string;
  now?: Date;
}): { plan: ChangePlan | null; rejected: Rejection[] } {
  const { inventory: inv, catalog, request } = args;
  const ctx = deviceContext(inv);
  const byName = new Map(inv.packages.map((p) => [p.name, p]));
  const mem = new Map(inv.processes.map((p) => [p.name, p.kb]));
  const actions: PlanAction[] = [];
  const rejected: Rejection[] = [];
  const seen = new Set<string>();

  const add = (kind: ActionKind, pkg: string) => {
    if (seen.has(pkg)) return rejected.push({ pkg, reason: 'Pedido repetido.' });
    const info = byName.get(pkg);
    if (!info) return rejected.push({ pkg, reason: 'Este app não existe nesta TV.' });
    const c = classifyPackage(pkg, ctx, catalog);
    if (kind === 'disable') {
      if (!info.system) return rejected.push({ pkg, reason: 'É um app instalado por você: desinstale pela própria TV, se quiser.' });
      if (!info.enabled) return rejected.push({ pkg, reason: 'Já está desativado.' });
      if (c.level === 'protected') return rejected.push({ pkg, reason: `Intocável: ${c.label}. ${c.description ?? ''}`.trim() });
    } else if (info.enabled) {
      return rejected.push({ pkg, reason: 'Já está ativo.' });
    }
    seen.add(pkg);
    actions.push({
      kind, pkg, label: c.label, level: c.level, estimatedKb: kind === 'disable' ? mem.get(pkg) ?? null : null,
      ...(c.effect ? { effect: c.effect } : {}),
    });
  };

  for (const pkg of request.disable ?? []) add('disable', pkg);
  for (const pkg of request.enable ?? []) add('enable', pkg);

  if (actions.length > MAX_ACTIONS) {
    return { plan: null, rejected: [...rejected, { pkg: '*', reason: `No máximo ${MAX_ACTIONS} mudanças por vez.` }] };
  }
  if (actions.length === 0) return { plan: null, rejected };

  const base = { serial: args.serial, deviceId: inv.deviceId, actions };
  const plan: ChangePlan = {
    schemaVersion: 1,
    id: randomUUID(),
    kind: args.kind ?? 'cleanup',
    title: args.title ?? describe(actions),
    serial: args.serial,
    deviceId: inv.deviceId,
    createdAt: (args.now ?? new Date()).toISOString(),
    actions,
    hash: hashPlan(base),
    ...(args.basedOnSnapshot ? { basedOnSnapshot: args.basedOnSnapshot } : {}),
  };
  return { plan, rejected };
}

function describe(actions: PlanAction[]): string {
  const d = actions.filter((a) => a.kind === 'disable').length;
  const e = actions.length - d;
  return [d ? `Desativar ${d} ${d === 1 ? 'app' : 'apps'}` : '', e ? `reativar ${e} ${e === 1 ? 'app' : 'apps'}` : ''].filter(Boolean).join(' e ');
}

/** Revalida um plano contra a leitura MAIS RECENTE da TV, logo antes de executar. */
export function revalidatePlan(plan: ChangePlan, fresh: DeviceInventory, catalog: Catalog): Rejection[] {
  const problems: Rejection[] = [];
  if (hashPlan(plan) !== plan.hash) problems.push({ pkg: '*', reason: 'O plano foi alterado depois de revisado.' });
  if (fresh.deviceId !== plan.deviceId) problems.push({ pkg: '*', reason: 'A TV conectada não é a mesma do plano.' });
  const again = buildPlan({
    inventory: fresh,
    serial: plan.serial,
    catalog,
    request: {
      disable: plan.actions.filter((a) => a.kind === 'disable').map((a) => a.pkg),
      enable: plan.actions.filter((a) => a.kind === 'enable').map((a) => a.pkg),
    },
  });
  problems.push(...again.rejected);
  return problems;
}

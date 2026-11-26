// Teste de caos: centenas de planos aleatórios com falhas aleatórias, em todas as marcas simuladas.
// Propriedade: ao final (inclusive após desfazer uma mudança interrompida), a TV está EXATAMENTE
// como antes ou EXATAMENTE como planejado. Nunca no meio. Nunca com intocável desativado.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { AdbExecutor } from '../../src/adb/index.ts';
import { classifyPackage, loadCatalog } from '../../src/catalog/index.ts';
import { buildPlan, deviceContext, executePlan, rollbackIncomplete } from '../../src/changes/index.ts';
import { AndroidFamilyDriver } from '../../src/drivers/index.ts';
import { createFakeNetwork, type FakeBehavior } from '../../src/fake/index.ts';

const catalog = loadCatalog();
const HOSTS = ['192.168.0.50', '192.168.0.51', '192.168.0.52', '192.168.0.53', '192.168.0.54'];
const ITERATIONS = Number(process.env.TVSA_CHAOS ?? 150);

function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

it(`caos: ${ITERATIONS} planos com falhas aleatórias nunca deixam a TV pela metade`, async () => {
  const rand = rng(20261126);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tvsa-chaos-'));
  const stats: Record<string, number> = {};

  for (let i = 0; i < ITERATIONS; i++) {
    const world = createFakeNetwork();
    const host = pick(HOSTS);
    const serial = `${host}:5555`;
    const adb = new AdbExecutor(world);
    await adb.connect(host);
    await adb.devices();
    await adb.devices();
    const inv = await new AndroidFamilyDriver(adb.forDevice(serial)).readInventory();
    const ctx = deviceContext(inv);
    const candidates = inv.packages.filter((p) => p.system && p.enabled && classifyPackage(p.name, ctx, catalog).level !== 'protected');
    const chosen = [...new Set(Array.from({ length: 1 + Math.floor(rand() * 6) }, () => pick(candidates).name))];
    const { plan } = buildPlan({ inventory: inv, serial, catalog, request: { disable: chosen } });
    expect(plan, `iteração ${i}`).not.toBeNull();

    const outside = candidates.map((p) => p.name).filter((n) => !chosen.includes(n));
    const k = 1 + Math.floor(rand() * plan!.actions.length);
    const failures: FakeBehavior[] = [
      {},
      { failWriteAt: k },
      { lieOnWrite: true },
      { dropAfterWrites: k - 1 },
      outside.length ? { sideEffectDisable: { [plan!.actions[0]!.pkg]: pick(outside) } } : {},
      { denyWrite: [pick(chosen)] },
    ];
    const behavior = pick(failures);
    world.setBehavior(host, behavior);

    const original = new Map(world.specOf(host)!.packages.map((p) => [p.name, p.enabled]));
    const planned = new Map(original);
    for (const a of plan!.actions) planned.set(a.pkg, a.kind === 'enable');

    const deps = { adb, catalog, dataDir: path.join(dataRoot, String(i)) };
    let result = await executePlan(plan!, deps);
    if (result.status === 'interrupted') {
      world.setBehavior(host, { dropAfterWrites: undefined });
      await adb.connect(host);
      result = await rollbackIncomplete(plan!.id, serial, deps);
    }
    stats[result.status] = (stats[result.status] ?? 0) + 1;

    const final = new Map(world.specOf(host)!.packages.map((p) => [p.name, p.enabled]));
    const same = (a: Map<string, boolean>) => [...a].every(([n, e]) => final.get(n) === e);
    const ctxLabel = `iteração ${i} (${host}, ${JSON.stringify(behavior)}, status ${result.status}: ${result.message})`;
    if (result.status === 'completed') expect(same(planned), ctxLabel).toBe(true);
    else expect(same(original), ctxLabel).toBe(true);
    for (const [name, enabled] of final) {
      if (!enabled && original.get(name)) expect(classifyPackage(name, ctx, catalog).level, ctxLabel).not.toBe('protected');
    }
  }
  await fs.rm(dataRoot, { recursive: true, force: true });
  expect(Object.keys(stats).sort()).toEqual(expect.arrayContaining(['completed', 'rolled-back']));
}, 120_000);

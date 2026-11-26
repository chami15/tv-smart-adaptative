import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkAllowlist } from '../../src/adb/allowlist.ts';
import { checkWriteAllowlist } from '../../src/adb/write-allowlist.ts';
import { loadCatalog } from '../../src/catalog/index.ts';
import {
  buildPlan, buildRestorePlan, executePlan, type Journal, JournalStore, rollbackIncomplete,
} from '../../src/changes/index.ts';
import { listSnapshots, loadSnapshot } from '../../src/snapshot/index.ts';
import { connected } from './helpers.ts';

const catalog = loadCatalog();
const HOST = '192.168.0.50';
let dataDir: string;
beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tvsa-exec-'));
});
afterEach(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});

async function setup(disable = ['com.tcl.guard', 'com.tcl.esticker', 'com.tcl.weather']) {
  const tv = await connected(HOST);
  const { plan } = buildPlan({ inventory: tv.inv, serial: tv.serial, catalog, request: { disable } });
  const deps = { adb: tv.adb, catalog, dataDir };
  const state = (pkg: string) => tv.world.packageState(HOST, pkg);
  return { ...tv, plan: plan!, deps, state };
}

describe('executor de planos', () => {
  it('caminho feliz: backup antes, aplica, confere, libera memória e registra no diário', async () => {
    const t = await setup();
    const r = await executePlan(t.plan, t.deps);
    expect(r.status).toBe('completed');
    expect(['com.tcl.guard', 'com.tcl.esticker', 'com.tcl.weather'].map(t.state)).toEqual([false, false, false]);
    expect(r.memoryAfterKb! - r.memoryBeforeKb!).toBe(31000 + 18000); // guard + esticker estavam na memória
    expect((await listSnapshots(dataDir)).length).toBe(1);
    expect((await new JournalStore(dataDir).load(t.plan.id))?.status).toBe('completed');
    // todas as escritas passaram pela allowlist de escrita; nada de intocável
    const writes = t.world.calls.filter((c) => !checkAllowlist(c).allowed);
    expect(writes.length).toBe(3);
    for (const w of writes) expect(checkWriteAllowlist(w).allowed).toBe(true);
  });

  it('falha no 2º passo → desfaz o 1º e a TV volta exatamente ao começo', async () => {
    const t = await setup();
    t.world.setBehavior(HOST, { failWriteAt: 2 });
    const r = await executePlan(t.plan, t.deps);
    expect(r.status).toBe('rolled-back');
    expect(r.message).toMatch(/SecurityException|confirmou/);
    expect(['com.tcl.guard', 'com.tcl.esticker', 'com.tcl.weather'].map(t.state)).toEqual([true, true, true]);
    expect(r.steps.map((s) => s.status)).toEqual(['undone', 'undone', 'pending']);
  });

  it('TV diz "sucesso" mas não muda nada → conferência pega e desfaz', async () => {
    const t = await setup();
    t.world.setBehavior(HOST, { lieOnWrite: true });
    const r = await executePlan(t.plan, t.deps);
    expect(r.status).toBe('rolled-back');
    expect(r.message).toMatch(/conferência/);
  });

  it('efeito colateral inesperado (outro app desativado junto) → checagem de saúde desfaz', async () => {
    const t = await setup(['com.tcl.guard']);
    t.world.setBehavior(HOST, { sideEffectDisable: { 'com.tcl.guard': 'com.tcl.usercenter' } });
    const r = await executePlan(t.plan, t.deps);
    expect(r.status).toBe('rolled-back');
    expect(r.message).toMatch(/fora do plano/);
    expect(t.state('com.tcl.guard')).toBe(true);
    expect(t.state('com.tcl.usercenter')).toBe(true); // o efeito colateral também foi desfeito (achado pelo teste de caos)
  });

  it('rede cai no meio → "interrompido"; nova mudança é recusada até desfazer; ao voltar, desfaz tudo', async () => {
    const t = await setup();
    t.world.setBehavior(HOST, { dropAfterWrites: 1 });
    const r = await executePlan(t.plan, t.deps);
    expect(r.status).toBe('interrupted');
    expect(t.state('com.tcl.guard')).toBe(false); // ficou pela metade na TV

    const again = buildPlan({ inventory: t.inv, serial: t.serial, catalog, request: { disable: ['com.tcl.usercenter'] } }).plan!;
    expect((await executePlan(again, t.deps)).status).toBe('refused');

    // a TV volta (e ganhou outro IP!)
    t.world.setBehavior(HOST, { dropAfterWrites: undefined });
    t.world.addTv('192.168.0.77', t.world.specOf(HOST)!);
    await t.adb.connect('192.168.0.77');
    await t.adb.devices();
    await t.adb.devices(); // usuário aceita na TV
    const fixed = await rollbackIncomplete(t.plan.id, '192.168.0.77:5555', t.deps);
    expect(fixed.status).toBe('rolled-back');
    expect(t.state('com.tcl.guard')).toBe(true);
    expect(await new JournalStore(dataDir).needingAttention()).toEqual([]);
  });

  it('Studio fechou no meio (diário "running" com passo iniciado) → desfazer ao reabrir', async () => {
    const t = await setup();
    // simula: o 1º passo foi aplicado na TV e o Studio morreu antes de gravar "done"
    const journal: Journal = {
      schemaVersion: 1, planId: t.plan.id, plan: t.plan, deviceId: t.plan.deviceId, status: 'running', snapshotDir: 'x',
      steps: t.plan.actions.map((a, i) => ({ kind: a.kind, pkg: a.pkg, label: a.label, status: i === 0 ? 'started' : 'pending' })),
      startedAt: new Date().toISOString(), updatedAt: '',
    };
    await new JournalStore(dataDir).save(journal);
    t.world.specOf(HOST)!.packages.find((p) => p.name === 'com.tcl.guard')!.enabled = false;
    const r = await rollbackIncomplete(t.plan.id, t.serial, t.deps);
    expect(r.status).toBe('rolled-back');
    expect(t.state('com.tcl.guard')).toBe(true);
  });

  it('recusa desfazer em outra TV', async () => {
    const t = await setup();
    t.world.setBehavior(HOST, { dropAfterWrites: 1 });
    await executePlan(t.plan, t.deps);
    await t.adb.connect('192.168.0.51');
    expect((await rollbackIncomplete(t.plan.id, '192.168.0.51:5555', t.deps)).message).toMatch(/não é a mesma/);
  });

  it('plano adulterado e plano desatualizado são recusados sem tocar na TV', async () => {
    const t = await setup();
    const before = t.world.calls.length;
    const tampered = { ...t.plan, actions: [...t.plan.actions, { ...t.plan.actions[0]!, pkg: 'com.tcl.tvinput' }] };
    expect((await executePlan(tampered, t.deps)).status).toBe('refused');
    t.world.specOf(HOST)!.packages.find((p) => p.name === 'com.tcl.guard')!.enabled = false; // alguém mudou na TV
    const r = await executePlan(t.plan, t.deps);
    expect(r.status).toBe('refused');
    expect(r.problems?.[0]?.reason).toMatch(/Já está desativado/);
    expect(t.world.calls.slice(before).every((c) => checkAllowlist(c).allowed)).toBe(true); // só leituras
  });
});

describe('restaurar a partir de backup', () => {
  it('limpa, depois restaura o backup de antes → todos os apps voltam exatamente ao estado original', async () => {
    const t = await setup();
    const original = t.world.specOf(HOST)!.packages.map((p) => [p.name, p.enabled]);
    const r = await executePlan(t.plan, t.deps);
    const snap = await loadSnapshot(r.snapshotDir!, dataDir);
    const current = await t.read();
    const { plan } = buildRestorePlan({ snapshot: snap.inventory, current, serial: t.serial, catalog, snapshotDir: r.snapshotDir!, snapshotDate: snap.createdAt });
    expect(plan?.kind).toBe('restore');
    expect(plan?.actions.every((a) => a.kind === 'enable')).toBe(true);
    expect((await executePlan(plan!, t.deps)).status).toBe('completed');
    expect(t.world.specOf(HOST)!.packages.map((p) => [p.name, p.enabled])).toEqual(original);
  });

  it('backup de outra TV é recusado; backup fora da pasta de backups é recusado', async () => {
    const t = await setup();
    const other = await connected('192.168.0.51', t.world);
    expect(buildRestorePlan({ snapshot: other.inv, current: t.inv, serial: t.serial, catalog, snapshotDir: 'x', snapshotDate: '2026-01-01' }).error).toMatch(/outra TV/);
    await expect(loadSnapshot(path.join(dataDir, '..'), dataDir)).rejects.toMatchObject({ code: 'INVALID_SNAPSHOT' });
  });
});

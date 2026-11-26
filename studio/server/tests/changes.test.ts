import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createFakeNetwork, type FakeTvWorld } from '@tvsa/core';
import { afterEach, describe, expect, it } from 'vitest';
import { startStudio, type StudioServer } from '../src/app.ts';
import { api } from './helpers.ts';

let studio: StudioServer & { world: FakeTvWorld; dataDir: string };
afterEach(async () => {
  await studio.close();
  await fs.rm(studio.dataDir, { recursive: true, force: true });
});

async function start(opts: { simulated?: boolean; allowRealWrites?: boolean } = {}) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tvsa-chg-'));
  const world = createFakeNetwork();
  const s = await startStudio({ dataDir, transport: world, ...opts });
  studio = Object.assign(s, { world, dataDir });
  return studio;
}

async function connectTcl() {
  await api(studio, 'POST', '/api/connect', { host: '192.168.0.50' });
  await api(studio, 'GET', '/api/status');
  await api(studio, 'GET', '/api/status');
  await api(studio, 'POST', '/api/inventory', { serial: SERIAL });
}
const SERIAL = '192.168.0.50:5555';

describe('API de limpeza (TV simulada)', () => {
  it('cleanup: só apps do sistema, classificados; entradas e Play Services 🔴', async () => {
    await start();
    await connectTcl();
    const r = await api(studio, 'POST', '/api/cleanup', { serial: SERIAL });
    const byPkg = Object.fromEntries(r.body.items.map((i: { pkg: string }) => [i.pkg, i]));
    expect(byPkg['com.tcl.tvinput'].level).toBe('protected');
    expect(byPkg['com.google.android.gms'].level).toBe('protected');
    expect(byPkg['com.tcl.guard']).toMatchObject({ level: 'safe', enabled: true, memoryKb: 31000 });
    expect(byPkg['com.globo.globotv']).toBeUndefined(); // app do usuário não entra
  });

  it('plano → executar → concluído; o mesmo plano não executa duas vezes', async () => {
    await start();
    await connectTcl();
    const p = await api(studio, 'POST', '/api/plan', { serial: SERIAL, disable: ['com.tcl.guard', 'com.tcl.tvinput'] });
    expect(p.body.plan.actions).toHaveLength(1);
    expect(p.body.rejected[0].pkg).toBe('com.tcl.tvinput');
    const e = await api(studio, 'POST', '/api/plan/execute', { planId: p.body.plan.id, hash: p.body.plan.hash });
    expect(e.body.status).toBe('completed');
    expect(studio.world.packageState('192.168.0.50', 'com.tcl.guard')).toBe(false);
    const again = await api(studio, 'POST', '/api/plan/execute', { planId: p.body.plan.id, hash: p.body.plan.hash });
    expect(again.status).toBe(404);
  });

  it('duplo clique em Aplicar executa uma vez só', async () => {
    await start();
    await connectTcl();
    const p = await api(studio, 'POST', '/api/plan', { serial: SERIAL, disable: ['com.tcl.guard'] });
    const body = { planId: p.body.plan.id, hash: p.body.plan.hash };
    const [a, b] = await Promise.all([api(studio, 'POST', '/api/plan/execute', body), api(studio, 'POST', '/api/plan/execute', body)]);
    expect([a.body.status, b.body.status]).toEqual(['completed', 'completed']);
    const writes = studio.world.calls.filter((c) => c.includes('disable-user'));
    expect(writes).toHaveLength(1);
  });

  it('hash diferente do revisado → 409; entradas inválidas → 400', async () => {
    await start();
    await connectTcl();
    const p = await api(studio, 'POST', '/api/plan', { serial: SERIAL, disable: ['com.tcl.guard'] });
    const bad = await api(studio, 'POST', '/api/plan/execute', { planId: p.body.plan.id, hash: 'a'.repeat(64) });
    expect(bad.status).toBe(409);
    expect((await api(studio, 'POST', '/api/plan', { serial: SERIAL, disable: ['x; reboot'] })).status).toBe(400);
    expect((await api(studio, 'POST', '/api/plan', { serial: SERIAL, disable: 'com.tcl.guard' })).status).toBe(400);
  });

  it('mudança interrompida aparece em /api/pending e é desfeita pela API', async () => {
    await start();
    await connectTcl();
    studio.world.setBehavior('192.168.0.50', { dropAfterWrites: 1 });
    const p = await api(studio, 'POST', '/api/plan', { serial: SERIAL, disable: ['com.tcl.guard', 'com.tcl.esticker'] });
    const e = await api(studio, 'POST', '/api/plan/execute', { planId: p.body.plan.id, hash: p.body.plan.hash });
    expect(e.body.status).toBe('interrupted');
    const pending = await api(studio, 'GET', '/api/pending');
    expect(pending.body).toHaveLength(1);
    studio.world.setBehavior('192.168.0.50', { dropAfterWrites: undefined });
    await api(studio, 'POST', '/api/connect', { host: '192.168.0.50' });
    const rb = await api(studio, 'POST', '/api/pending/rollback', { planId: pending.body[0].planId, serial: SERIAL });
    expect(rb.body.status).toBe('rolled-back');
    expect(studio.world.packageState('192.168.0.50', 'com.tcl.guard')).toBe(true);
    expect((await api(studio, 'GET', '/api/pending')).body).toEqual([]);
  });

  it('restaurar: plano a partir de backup; backup fora da pasta → 400', async () => {
    await start();
    await connectTcl();
    const p = await api(studio, 'POST', '/api/plan', { serial: SERIAL, disable: ['com.tcl.guard'] });
    const e = await api(studio, 'POST', '/api/plan/execute', { planId: p.body.plan.id, hash: p.body.plan.hash });
    const r = await api(studio, 'POST', '/api/restore/plan', { serial: SERIAL, snapshotDir: e.body.snapshotDir });
    expect(r.body.plan.actions).toEqual([expect.objectContaining({ kind: 'enable', pkg: 'com.tcl.guard' })]);
    const x = await api(studio, 'POST', '/api/restore/plan', { serial: SERIAL, snapshotDir: os.tmpdir() });
    expect(x.status).toBe(400);
    const list = await api(studio, 'GET', `/api/snapshots?deviceId=${p.body.plan.deviceId}`);
    expect(list.body.length).toBeGreaterThan(0);
  });
});

describe('trava da TV real', () => {
  it('modo real sem liberação: calcula o plano, mas executar é recusado e nada chega à TV', async () => {
    await start({ simulated: false });
    await connectTcl();
    const st = await api(studio, 'GET', '/api/status');
    expect(st.body.mode).toBe('real');
    expect(st.body.writes.allowed).toBe(false);
    const p = await api(studio, 'POST', '/api/plan', { serial: SERIAL, disable: ['com.tcl.guard'] });
    expect(p.body.plan.actions).toHaveLength(1);
    const e = await api(studio, 'POST', '/api/plan/execute', { planId: p.body.plan.id, hash: p.body.plan.hash });
    expect(e.status).toBe(403);
    expect(e.body.error.code).toBe('REAL_WRITES_LOCKED');
    expect(studio.world.calls.some((c) => c.includes('disable-user'))).toBe(false);
    expect(studio.world.packageState('192.168.0.50', 'com.tcl.guard')).toBe(true);
  });

  it('modo real com liberação explícita: executa', async () => {
    await start({ simulated: false, allowRealWrites: true });
    await connectTcl();
    const p = await api(studio, 'POST', '/api/plan', { serial: SERIAL, disable: ['com.tcl.guard'] });
    const e = await api(studio, 'POST', '/api/plan/execute', { planId: p.body.plan.id, hash: p.body.plan.hash });
    expect(e.body.status).toBe('completed');
  });
});

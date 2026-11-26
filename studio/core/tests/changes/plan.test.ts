import { describe, expect, it } from 'vitest';
import { checkAllowlist } from '../../src/adb/allowlist.ts';
import { checkWriteAllowlist, writeArgs } from '../../src/adb/write-allowlist.ts';
import { loadCatalog } from '../../src/catalog/index.ts';
import { buildPlan, hashPlan, revalidatePlan, WriteGrant } from '../../src/changes/index.ts';
import { connected } from './helpers.ts';

const catalog = loadCatalog();

describe('plano de mudanças', () => {
  it('monta plano com rótulos em português e recusa o que não pode', async () => {
    const { inv, serial } = await connected();
    const { plan, rejected } = buildPlan({
      inventory: inv, serial, catalog,
      request: {
        disable: ['com.tcl.guard', 'com.tcl.esticker', 'com.tcl.tvinput', 'com.google.android.gms', 'com.globo.globotv', 'com.tcl.appmarket', 'com.nao.existe', 'com.tcl.guard', 'com.google.android.apps.tv.launcherx'],
        enable: ['com.tcl.appmarket'],
      },
    });
    expect(plan?.actions.map((a) => [a.kind, a.pkg])).toEqual([
      ['disable', 'com.tcl.guard'],
      ['disable', 'com.tcl.esticker'],
      ['enable', 'com.tcl.appmarket'],
    ]);
    expect(plan?.actions[0]).toMatchObject({ label: 'TCL Guard (limpeza da TCL)', level: 'safe', estimatedKb: 31000 });
    const reasons = Object.fromEntries(rejected.map((r) => [r.pkg, r.reason]));
    expect(reasons['com.tcl.tvinput']).toMatch(/Intocável/);
    expect(reasons['com.google.android.gms']).toMatch(/Intocável/);
    expect(reasons['com.globo.globotv']).toMatch(/instalado por você/);
    expect(reasons['com.nao.existe']).toMatch(/não existe/);
    expect(reasons['com.google.android.apps.tv.launcherx']).toMatch(/Intocável/);
    expect(rejected.some((r) => r.reason === 'Pedido repetido.')).toBe(true);
  });

  it('plano vazio → null', async () => {
    const { inv, serial } = await connected();
    expect(buildPlan({ inventory: inv, serial, catalog, request: { disable: ['com.tcl.tv'] } }).plan).toBeNull();
  });

  it('revalidação pega plano adulterado, TV trocada e estado que mudou', async () => {
    const { inv, serial } = await connected();
    const { plan } = buildPlan({ inventory: inv, serial, catalog, request: { disable: ['com.tcl.guard'] } });
    expect(revalidatePlan(plan!, inv, catalog)).toEqual([]);
    const tampered = { ...plan!, actions: [{ ...plan!.actions[0]!, pkg: 'com.tcl.tvinput' }] };
    expect(revalidatePlan(tampered, inv, catalog).map((r) => r.reason).join(' ')).toMatch(/alterado/);
    const other = { ...inv, deviceId: 'outro' };
    expect(revalidatePlan(plan!, other, catalog).map((r) => r.reason).join(' ')).toMatch(/não é a mesma/);
    const changed = { ...inv, packages: inv.packages.map((p) => (p.name === 'com.tcl.guard' ? { ...p, enabled: false } : p)) };
    expect(revalidatePlan(plan!, changed, catalog).map((r) => r.reason).join(' ')).toMatch(/Já está desativado/);
    expect(hashPlan(plan!)).toBe(plan!.hash);
  });
});

describe('trava de escrita', () => {
  const S = '192.168.0.50:5555';
  it('allowlist de leitura continua recusando escrita', () => {
    expect(checkAllowlist(writeArgs(S, 'disable', 'com.tcl.guard')).allowed).toBe(false);
  });

  it('allowlist de escrita: só disable-user/enable de app válido e não intocável', () => {
    expect(checkWriteAllowlist(writeArgs(S, 'disable', 'com.tcl.guard')).allowed).toBe(true);
    expect(checkWriteAllowlist(writeArgs(S, 'enable', 'com.google.android.gms')).allowed).toBe(true); // reativar é sempre ok
    expect(checkWriteAllowlist(writeArgs(S, 'disable', 'com.google.android.gms')).allowed).toBe(false);
    expect(checkWriteAllowlist(['-s', S, 'shell', 'pm', 'uninstall', 'com.tcl.guard']).allowed).toBe(false);
    expect(checkWriteAllowlist(['-s', S, 'shell', 'pm', 'disable-user', 'com.tcl.guard']).allowed).toBe(false);
    expect(checkWriteAllowlist(['-s', S, 'shell', 'pm', 'clear', 'com.tcl.guard']).allowed).toBe(false);
    expect(checkWriteAllowlist(['shell', 'pm', 'enable', 'com.tcl.guard']).allowed).toBe(false);
    expect(checkWriteAllowlist(writeArgs(S, 'disable', 'com.x;reboot')).allowed).toBe(false);
  });

  it('escrita sem autorização ou fora do plano é recusada e não chega à TV', async () => {
    const { adb, serial, world, inv } = await connected();
    const before = world.calls.length;
    const { plan } = buildPlan({ inventory: inv, serial, catalog, request: { disable: ['com.tcl.guard'] } });
    const grant = WriteGrant.forPlan(plan!);
    await expect(adb.execWrite(writeArgs(serial, 'disable', 'com.tcl.esticker'), grant)).rejects.toMatchObject({ code: 'COMMAND_REFUSED' });
    await expect(adb.execWrite(writeArgs(serial, 'disable', 'com.tcl.guard'), {} as WriteGrant)).rejects.toMatchObject({ code: 'COMMAND_REFUSED' });
    await expect(adb.exec(writeArgs(serial, 'disable', 'com.tcl.guard'))).rejects.toMatchObject({ code: 'COMMAND_REFUSED' });
    expect(world.calls.length).toBe(before);
  });
});

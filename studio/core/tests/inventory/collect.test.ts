import { describe, expect, it } from 'vitest';
import { AdbExecutor } from '../../src/adb/index.ts';
import { AndroidFamilyDriver } from '../../src/drivers/index.ts';
import { createFakeNetwork, FAKE_NETWORK } from '../../src/fake/index.ts';
import { checkAllowlist } from '../../src/adb/allowlist.ts';

const NOW = new Date('2026-11-26T12:00:00Z');

async function inventoryOf(host: string) {
  const world = createFakeNetwork();
  const adb = new AdbExecutor(world);
  await adb.connect(host);
  await adb.devices();
  await adb.devices();
  const inv = await new AndroidFamilyDriver(adb.forDevice(`${host}:5555`)).readInventory(NOW);
  return { inv, world };
}

describe('inventário adaptativo (qualquer marca)', () => {
  it.each([
    ['192.168.0.50', 'TCL', 'google-tv', true, 'low', '4k'],
    ['192.168.0.51', 'Philips', 'android-tv', true, 'low', '1080p'],
    ['192.168.0.52', 'Xiaomi', 'android-tv', true, 'low', '4k'],
    ['192.168.0.53', 'Sony', 'google-tv', true, 'medium', '4k'],
    ['192.168.0.54', 'Android', 'android-tv', true, 'low', '720p'],
    ['192.168.0.55', 'Amazon', 'fire-os', false, 'low', '1080p'],
    ['192.168.0.56', 'motorola', 'android-non-tv', false, 'high', '1080p'],
  ])('%s → %s / %s', async (host, brand, platform, supported, ram, res) => {
    const { inv } = await inventoryOf(host);
    expect(inv.device.brand).toBe(brand);
    expect(inv.device.platform).toBe(platform);
    expect(inv.device.supported).toBe(supported);
    expect(inv.memory.ramClass).toBe(ram);
    expect(inv.display.resolutionClass).toBe(res);
    expect(inv.packages.length).toBeGreaterThan(5);
    expect(inv.warnings).toEqual([]);
  });

  it('capacidades: TV suportada tem limpeza/launcher planejados; não suportada não oferece escrita', async () => {
    const tcl = (await inventoryOf('192.168.0.50')).inv;
    expect(tcl.capabilities.find((c) => c.id === 'disableApps')).toMatchObject({ status: 'planned', phase: 3 });
    const fire = (await inventoryOf('192.168.0.55')).inv;
    for (const id of ['disableApps', 'installLauncher', 'takeOverHome', 'pushProfile']) {
      expect(fire.capabilities.find((c) => c.id === id)?.status).toBe('unsupported');
    }
  });

  it('detecta app desativado, app de sistema e a tela inicial atual', async () => {
    const { inv } = await inventoryOf('192.168.0.50');
    expect(inv.packages.find((p) => p.name === 'com.tcl.appmarket')).toEqual({ name: 'com.tcl.appmarket', system: true, enabled: false });
    expect(inv.packages.find((p) => p.name === 'com.globo.globotv')?.system).toBe(false);
    expect(inv.currentHome?.package).toBe('com.google.android.apps.tv.launcherx');
    expect(inv.processes[0]).toEqual({ name: 'com.google.android.apps.tv.launcherx', kb: 192000 });
  });

  it('privacidade: serial, hostname e outros dados pessoais nunca entram no inventário', async () => {
    const { inv } = await inventoryOf('192.168.0.50');
    const json = JSON.stringify(inv);
    expect(json).not.toContain('SIMULADO0001');
    expect(json).not.toContain('tv-sala-simulada');
    expect(json).not.toContain('192.168.0.50');
    expect(inv.deviceId).toMatch(/^[0-9a-f]{12}$/);
  });

  it('segurança: a leitura completa só envia comandos da allowlist (nenhuma escrita)', async () => {
    for (const { host } of FAKE_NETWORK.slice(0, 7)) {
      const { world } = await inventoryOf(host);
      for (const call of world.calls) expect(checkAllowlist(call).allowed).toBe(true);
      const joined = world.calls.map((c) => c.join(' ')).join('\n');
      expect(joined).not.toMatch(/disable|enable|uninstall|install|push|settings put|reboot/);
    }
  });

  it('rede cai no meio da leitura: erro DEVICE_OFFLINE (sem inventário pela metade)', async () => {
    const world = createFakeNetwork();
    const adb = new AdbExecutor(world);
    await adb.connect('192.168.0.63');
    await expect(new AndroidFamilyDriver(adb.forDevice('192.168.0.63:5555')).readInventory(NOW)).rejects.toMatchObject({
      code: 'DEVICE_OFFLINE',
    });
  });

  it('respostas corrompidas: não quebra, devolve avisos e plataforma desconhecida', async () => {
    const world = createFakeNetwork();
    const adb = new AdbExecutor(world);
    await adb.connect('192.168.0.64');
    const inv = await new AndroidFamilyDriver(adb.forDevice('192.168.0.64:5555')).readInventory(NOW);
    expect(inv.warnings.length).toBeGreaterThan(0);
    expect(inv.device.supported).toBe(false);
  });
});

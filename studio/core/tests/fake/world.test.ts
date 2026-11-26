import { describe, expect, it } from 'vitest';
import { AdbExecutor } from '../../src/adb/index.ts';
import { createFakeNetwork, loadFakeDevices } from '../../src/fake/index.ts';

const setup = () => {
  const world = createFakeNetwork();
  return { world, adb: new AdbExecutor(world) };
};

describe('FakeTvWorld', () => {
  it('fixtures são marcadas como simuladas e não têm dados reais', () => {
    for (const spec of loadFakeDevices().values()) {
      expect(spec.simulated).toBe(true);
      expect(spec.props['ro.serialno']).toMatch(/SIMULADO/);
    }
  });

  it('TCL: fica "unauthorized" até o usuário aceitar (simulado após 2 consultas)', async () => {
    const { adb } = setup();
    await adb.connect('192.168.0.50');
    expect((await adb.devices())[0]?.state).toBe('unauthorized');
    expect((await adb.devices())[0]?.state).toBe('device');
    expect(await adb.forDevice('192.168.0.50:5555').state()).toBe('device');
  });

  it('usuário nunca aceita: comandos de shell dão DEVICE_UNAUTHORIZED', async () => {
    const { adb } = setup();
    await adb.connect('192.168.0.60');
    await expect(adb.forDevice('192.168.0.60:5555').getprop()).rejects.toMatchObject({ code: 'DEVICE_UNAUTHORIZED' });
  });

  it('IP sem TV, depuração desligada e TV que não responde', async () => {
    const { adb } = setup();
    await expect(adb.connect('192.168.0.99')).rejects.toMatchObject({ code: 'HOST_UNREACHABLE' });
    await expect(adb.connect('192.168.0.61')).rejects.toMatchObject({ code: 'CONNECTION_REFUSED' });
    await expect(adb.connect('192.168.0.62')).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('rede cai no meio: vira DEVICE_OFFLINE', async () => {
    const { adb } = setup();
    await adb.connect('192.168.0.63');
    const tv = adb.forDevice('192.168.0.63:5555');
    await tv.getprop();
    await tv.listPackages();
    await tv.procMeminfo();
    await expect(tv.wmSize()).rejects.toMatchObject({ code: 'DEVICE_OFFLINE' });
  });

  it('pareamento por código', async () => {
    const { adb } = setup();
    await expect(adb.pair('192.168.0.51', 37000, '000000')).rejects.toMatchObject({ code: 'PAIRING_FAILED' });
    await expect(adb.pair('192.168.0.51', 37000, '123456')).resolves.toBeUndefined();
  });

  it('gera saídas no formato do adb real', async () => {
    const { adb } = setup();
    await adb.connect('192.168.0.51');
    const tv = adb.forDevice('192.168.0.51:5555');
    expect(await tv.getprop()).toContain('[ro.product.brand]: [Philips]');
    expect(await tv.listPackages('-s')).toContain('package:org.droidtv.playtv');
    expect(await tv.wmSize()).toBe('Physical size: 1920x1080\n');
  });
});

// Bug encontrado na Fase 2: todas as TVs simuladas tinham o mesmo serial → mesmo deviceId,
// o que escondia a proteção "não desfazer mudança em outra TV".
it('cada TV da rede simulada tem identidade própria', async () => {
  const world = createFakeNetwork();
  const ids = new Set<string>();
  for (const host of ['192.168.0.50', '192.168.0.51', '192.168.0.60']) ids.add(world.specOf(host)!.props['ro.serialno']!);
  expect(ids.size).toBe(3);
});

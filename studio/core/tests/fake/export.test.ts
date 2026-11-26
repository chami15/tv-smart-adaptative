import { expect, it } from 'vitest';
import { AdbExecutor } from '../../src/adb/index.ts';
import { AndroidFamilyDriver } from '../../src/drivers/index.ts';
import { createFakeNetwork, FakeTvWorld, inventoryToFixture } from '../../src/fake/index.ts';

async function read(world: FakeTvWorld, host: string) {
  const adb = new AdbExecutor(world);
  await adb.connect(host);
  await adb.devices();
  await adb.devices();
  return new AndroidFamilyDriver(adb.forDevice(`${host}:5555`)).readInventory();
}

it('exporta inventário real como aparelho simulado anônimo e ida-e-volta preserva o essencial', async () => {
  const original = await read(createFakeNetwork(), '192.168.0.50');
  const fixture = inventoryToFixture(original, 'real-teste');

  const json = JSON.stringify(fixture);
  expect(json).not.toContain('com.globo.globotv'); // app do usuário renomeado
  expect(json).not.toContain('br.com.spotify.tv');
  expect(json).toContain('com.usuario.app1');
  expect(json).not.toContain('SIMULADO0001');
  expect(json).not.toContain('tv-sala-simulada');

  const world = new FakeTvWorld().addTv('10.0.0.9', fixture);
  const again = await read(world, '10.0.0.9');
  expect(again.device.platform).toBe(original.device.platform);
  expect(again.device.brand).toBe(original.device.brand);
  expect(again.packages.length).toBe(original.packages.length);
  expect(again.memory.ramClass).toBe(original.memory.ramClass);
  expect(again.display.resolutionClass).toBe(original.display.resolutionClass);
  expect(again.currentHome).toEqual(original.currentHome);
});

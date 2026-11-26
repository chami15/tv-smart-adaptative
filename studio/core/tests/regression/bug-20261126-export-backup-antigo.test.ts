// BUG 2026-11-26 — encontrado testando o exportador como usuário.
// Passos: npm run export:fixture -- "<backup feito antes do campo features existir>".
// Esperado: exporta normalmente. Obtido: TypeError (inv.features indefinido).
import { expect, it } from 'vitest';
import { AdbExecutor } from '../../src/adb/index.ts';
import { AndroidFamilyDriver } from '../../src/drivers/index.ts';
import { createFakeNetwork, FakeTvWorld, inventoryToFixture } from '../../src/fake/index.ts';
import type { DeviceInventory } from '../../src/inventory/index.ts';

it('exporta backup antigo sem o campo "features" e a TV continua sendo reconhecida', async () => {
  const adb = new AdbExecutor(createFakeNetwork());
  await adb.connect('192.168.0.51');
  const inv = await new AndroidFamilyDriver(adb.forDevice('192.168.0.51:5555')).readInventory();
  const old = { ...inv } as Partial<DeviceInventory>;
  delete old.features;

  const fixture = inventoryToFixture(old as DeviceInventory, 'antigo');
  const world = new FakeTvWorld().addTv('10.0.0.8', fixture);
  const adb2 = new AdbExecutor(world);
  await adb2.connect('10.0.0.8');
  const again = await new AndroidFamilyDriver(adb2.forDevice('10.0.0.8:5555')).readInventory();
  expect(again.device.platform).toBe('android-tv');
});

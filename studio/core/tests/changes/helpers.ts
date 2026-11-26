import { AdbExecutor } from '../../src/adb/index.ts';
import { AndroidFamilyDriver } from '../../src/drivers/index.ts';
import { createFakeNetwork, type FakeTvWorld } from '../../src/fake/index.ts';

export async function connected(host = '192.168.0.50', world: FakeTvWorld = createFakeNetwork()) {
  const adb = new AdbExecutor(world);
  await adb.connect(host);
  await adb.devices();
  await adb.devices();
  const serial = `${host}:5555`;
  const read = () => new AndroidFamilyDriver(adb.forDevice(serial)).readInventory();
  return { world, adb, serial, read, inv: await read() };
}

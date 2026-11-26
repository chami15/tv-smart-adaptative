import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AdbExecutor } from '../../src/adb/index.ts';
import { AndroidFamilyDriver } from '../../src/drivers/index.ts';
import { createFakeNetwork } from '../../src/fake/index.ts';
import { defaultDataDir, listSnapshots, safeSegment, writeSnapshot } from '../../src/snapshot/index.ts';

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'tvsa-snap-'));
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function tclInventory() {
  const world = createFakeNetwork();
  const adb = new AdbExecutor(world);
  await adb.connect('192.168.0.51');
  return new AndroidFamilyDriver(adb.forDevice('192.168.0.51:5555')).readInventory(new Date('2026-11-26T12:00:00Z'));
}

describe('snapshot', () => {
  it('nomes de pasta seguros no Windows', () => {
    expect(safeSegment('TCL: Smart/TV <Pro>?')).toBe('TCL-Smart-TV-Pro');
    expect(safeSegment('CON')).toBe('_CON');
    expect(safeSegment('nul')).toBe('_nul');
    expect(safeSegment('Televisão Ótima')).toBe('Televisao-Otima');
    expect(safeSegment('...  ')).toBe('item');
    expect(safeSegment('modelo.')).toBe('modelo');
    expect(safeSegment('a'.repeat(100))).toHaveLength(60);
  });

  it('pasta de dados padrão fica no perfil do usuário', () => {
    expect(defaultDataDir({}, 'C:\\Users\\Ana')).toBe(path.join('C:\\Users\\Ana', 'TVSmartAdaptative'));
    expect(defaultDataDir({ TVSA_HOME: '/x' }, '/home/a')).toBe('/x');
  });

  it('grava snapshot.json + apps.txt e lista depois', async () => {
    const inv = await tclInventory();
    const now = new Date(2026, 10, 26, 9, 5, 7);
    const r = await writeSnapshot(inv, tmp, { now });
    expect(path.basename(r.dir)).toBe('2026-11-26_09-05-07');
    expect(r.dir).toContain(path.join('backups', `Philips-43PFG6825-${inv.deviceId}`));
    const data = JSON.parse(await fs.readFile(r.files[0]!, 'utf8'));
    expect(data.kind).toBe('tvsa-snapshot');
    expect(data.inventory.packages.length).toBe(inv.packages.length);
    const txt = await fs.readFile(r.files[1]!, 'utf8');
    expect(txt).toContain('\r\n');
    expect(txt).toContain('org.droidtv.playtv');
    const list = await listSnapshots(tmp);
    expect(list).toHaveLength(1);
    expect(list[0]?.device).toBe('Philips 43PFG6825');
  });

  it('nunca sobrescreve: dois snapshots no mesmo segundo geram pastas diferentes', async () => {
    const inv = await tclInventory();
    const now = new Date(2026, 10, 26, 9, 5, 7);
    const [a, b] = await Promise.all([writeSnapshot(inv, tmp, { now }), writeSnapshot(inv, tmp, { now })]);
    expect(a.dir).not.toBe(b.dir);
    expect((await listSnapshots(tmp)).length).toBe(2);
  });

  it('listSnapshots ignora lixo e pasta inexistente', async () => {
    expect(await listSnapshots(path.join(tmp, 'nao-existe'))).toEqual([]);
    await fs.mkdir(path.join(tmp, 'backups', 'x', 'y'), { recursive: true });
    await fs.writeFile(path.join(tmp, 'backups', 'x', 'y', 'snapshot.json'), '{quebrado');
    expect(await listSnapshots(tmp)).toEqual([]);
  });
});

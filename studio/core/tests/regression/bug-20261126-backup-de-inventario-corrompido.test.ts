// BUG 2026-11-26 — encontrado em teste exploratório como usuário (TV simulada 192.168.0.64).
// Passos: conectar a uma TV que devolve respostas corrompidas → "Salvar backup agora".
// Esperado: o Studio recusa, porque um backup sem apps não serve para restaurar nada.
// Obtido: o backup vazio era salvo como se fosse válido (perigoso: a Fase 2 usa backups para desfazer).
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { AdbExecutor } from '../../src/adb/index.ts';
import { AndroidFamilyDriver } from '../../src/drivers/index.ts';
import { createFakeNetwork } from '../../src/fake/index.ts';
import { listSnapshots, writeSnapshot } from '../../src/snapshot/index.ts';

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'tvsa-bug-'));
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

it('recusa salvar backup de inventário corrompido/incompleto', async () => {
  const adb = new AdbExecutor(createFakeNetwork());
  await adb.connect('192.168.0.64');
  const inv = await new AndroidFamilyDriver(adb.forDevice('192.168.0.64:5555')).readInventory();
  await expect(writeSnapshot(inv, tmp)).rejects.toMatchObject({ code: 'INCOMPLETE_INVENTORY' });
  expect(await listSnapshots(tmp)).toEqual([]);
});

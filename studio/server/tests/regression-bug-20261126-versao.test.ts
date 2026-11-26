// BUG 2026-11-26 — depois de atualizar o código (git pull) com o Studio aberto, a página continuava antiga
// sem nenhum aviso. Agora /api/status informa a versão em execução e se há outra versão no disco.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createFakeNetwork } from '@tvsa/core';
import { afterEach, expect, it } from 'vitest';
import { startStudio, type StudioServer } from '../src/app.ts';
import { api } from './helpers.ts';

let studio: StudioServer | undefined;
afterEach(async () => {
  await studio?.close();
});

it('status avisa quando o código no disco mudou depois que o Studio abriu', async () => {
  let onDisk = 'abc1234';
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tvsa-ver-'));
  studio = await startStudio({ dataDir, transport: createFakeNetwork(), getVersion: () => onDisk });
  let s = await api(studio, 'GET', '/api/status');
  expect(s.body.version).toEqual({ running: 'abc1234', onDisk: 'abc1234', updateAvailable: false });
  onDisk = 'def5678'; // usuário deu git pull
  s = await api(studio, 'GET', '/api/status');
  expect(s.body.version).toEqual({ running: 'abc1234', onDisk: 'def5678', updateAvailable: true });
});

it('readCodeVersion lê o commit do git deste repositório', async () => {
  const { readCodeVersion } = await import('../src/version.ts');
  expect(readCodeVersion(path.resolve(import.meta.dirname, '../../..'))).toMatch(/^[0-9a-f]{7}$/);
  expect(readCodeVersion(os.tmpdir())).toBe('desconhecida');
});

// BUG 2026-11-26 (ver studio/core/tests/regression/bug-20261126-backup-de-inventario-corrompido.test.ts)
// A API deve responder com erro claro em português, e não 500.
import fs from 'node:fs/promises';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { api, startFakeStudio } from './helpers.ts';

let studio: Awaited<ReturnType<typeof startFakeStudio>>;
beforeEach(async () => {
  studio = await startFakeStudio();
});
afterEach(async () => {
  await studio.close();
  await fs.rm(studio.dataDir, { recursive: true, force: true });
});

it('backup de TV com respostas corrompidas → 422 INCOMPLETE_INVENTORY', async () => {
  await api(studio, 'POST', '/api/connect', { host: '192.168.0.64' });
  await api(studio, 'POST', '/api/inventory', { serial: '192.168.0.64:5555' });
  const r = await api(studio, 'POST', '/api/snapshot', { serial: '192.168.0.64:5555' });
  expect(r.status).toBe(422);
  expect(r.body.error.code).toBe('INCOMPLETE_INVENTORY');
  expect(r.body.error.message).toMatch(/Ler de novo/);
});

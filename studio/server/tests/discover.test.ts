import fs from 'node:fs/promises';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { api, request, startFakeStudio } from './helpers.ts';

let studio: Awaited<ReturnType<typeof startFakeStudio>>;
beforeEach(async () => {
  studio = await startFakeStudio();
});
afterEach(async () => {
  await studio.close();
  await fs.rm(studio.dataDir, { recursive: true, force: true });
});

it('POST /api/discover lista as TVs da rede, prontas primeiro', async () => {
  const r = await api(studio, 'POST', '/api/discover', {});
  expect(r.status).toBe(200);
  expect(r.body.tvs[0]).toMatchObject({ host: '192.168.0.50', name: 'TV da Sala', debuggingEnabled: true, adbPort: 5555 });
  const off = r.body.tvs.filter((t: { debuggingEnabled: boolean }) => !t.debuggingEnabled).map((t: { host: string }) => t.host);
  expect(off).toEqual(expect.arrayContaining(['192.168.0.61', '192.168.0.70']));
});

it('busca exige token e não envia nenhum comando adb', async () => {
  expect((await request(studio.port, { method: 'POST', path: '/api/discover' })).status).toBe(401);
  const before = (studio.service as unknown as { options: { transport: { calls: unknown[] } } }).options.transport.calls.length;
  await api(studio, 'POST', '/api/discover', {});
  const after = (studio.service as unknown as { options: { transport: { calls: unknown[] } } }).options.transport.calls.length;
  expect(after).toBe(before);
});

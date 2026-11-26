import fs from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { api, request, startFakeStudio } from './helpers.ts';

let studio: Awaited<ReturnType<typeof startFakeStudio>>;
beforeEach(async () => {
  studio = await startFakeStudio();
});
afterEach(async () => {
  await studio.close();
  await fs.rm(studio.dataDir, { recursive: true, force: true });
});

describe('segurança do servidor local', () => {
  it('escuta somente em 127.0.0.1', () => {
    expect((studio.server.address() as AddressInfo).address).toBe('127.0.0.1');
  });

  it('API sem token → 401; token errado → 401', async () => {
    expect((await request(studio.port, { path: '/api/status' })).status).toBe(401);
    const bad = await request(studio.port, { path: '/api/status', headers: { authorization: 'Bearer errado' } });
    expect(bad.status).toBe(401);
    expect(bad.body.error.message).toMatch(/Sessão inválida/);
  });

  it('Host estranho (DNS rebinding) → 403, mesmo com token', async () => {
    const r = await request(studio.port, {
      path: '/api/status',
      headers: { host: 'evil.example:80', authorization: `Bearer ${studio.token}` },
    });
    expect(r.status).toBe(403);
  });

  it('Origin de outro site → 403', async () => {
    const r = await request(studio.port, {
      method: 'POST',
      path: '/api/connect',
      headers: { origin: 'https://site-malicioso.com', authorization: `Bearer ${studio.token}`, 'content-type': 'application/json' },
      body: '{"host":"192.168.0.51"}',
    });
    expect(r.status).toBe(403);
  });

  it('POST sem JSON (formulário de outro site) → 415', async () => {
    const r = await request(studio.port, {
      method: 'POST',
      path: '/api/connect',
      headers: { authorization: `Bearer ${studio.token}`, 'content-type': 'text/plain' },
      body: 'host=1',
    });
    expect(r.status).toBe(415);
  });

  it('corpo gigante → 413', async () => {
    const r = await api(studio, 'POST', '/api/connect', { host: 'x'.repeat(20000) });
    expect(r.status).toBe(413);
  });

  it('arquivos estáticos: não deixa sair da pasta da página', async () => {
    for (const p of ['/../segredo.txt', '/%2e%2e/segredo.txt', '/..%5csegredo.txt', '/%2e%2e%2fsegredo.txt']) {
      const r = await request(studio.port, { path: p });
      expect(r.text).not.toContain('não pode vazar');
    }
    const ok = await request(studio.port, { path: '/app.js' });
    expect(ok.status).toBe(200);
    expect(ok.headers['content-security-policy']).toContain("default-src 'self'");
    expect(ok.headers['x-frame-options']).toBe('DENY');
  });

  it('a página (sem token) carrega; rota desconhecida volta para index.html', async () => {
    const r = await request(studio.port, { path: '/minha-tv' });
    expect(r.status).toBe(200);
    expect(r.text).toContain('<title>Studio</title>');
  });
});

describe('fluxo da API com TV simulada', () => {
  it('status informa modo simulado e adb', async () => {
    const r = await api(studio, 'GET', '/api/status');
    expect(r.status).toBe(200);
    expect(r.body.mode).toBe('fake');
    expect(r.body.adb.found).toBe(true);
    expect(r.body.fakeNetwork.length).toBeGreaterThan(5);
  });

  it('conectar → aguardar autorização → inventário → snapshot', async () => {
    const c = await api(studio, 'POST', '/api/connect', { host: '192.168.0.50' });
    expect(c.body).toEqual({ serial: '192.168.0.50:5555', already: false });

    const s1 = await api(studio, 'GET', '/api/status');
    expect(s1.body.devices[0].state).toBe('unauthorized');
    const s2 = await api(studio, 'GET', '/api/status');
    expect(s2.body.devices[0].state).toBe('device');

    const inv = await api(studio, 'POST', '/api/inventory', { serial: '192.168.0.50:5555' });
    expect(inv.status).toBe(200);
    expect(inv.body.device.platform).toBe('google-tv');

    const snap = await api(studio, 'POST', '/api/snapshot', { serial: '192.168.0.50:5555' });
    expect(snap.status).toBe(200);
    expect(snap.body.dir).toContain(studio.dataDir);
    const list = await api(studio, 'GET', '/api/snapshots');
    expect(list.body).toHaveLength(1);
  });

  it('dois cliques rápidos em "Conectar" não quebram', async () => {
    const [a, b] = await Promise.all([
      api(studio, 'POST', '/api/connect', { host: '192.168.0.51' }),
      api(studio, 'POST', '/api/connect', { host: '192.168.0.51' }),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
  });

  it.each([
    [{ host: '192.168.0' }, 400, 'INVALID_ARGUMENT', /IP inválido/],
    [{ host: '192.168.0.51', port: 99999 }, 400, 'INVALID_ARGUMENT', /Porta inválida/],
    [{ host: '192.168.0.99' }, 502, 'HOST_UNREACHABLE', /não foi encontrada/],
    [{ host: '192.168.0.61' }, 502, 'CONNECTION_REFUSED', /depuração/],
    [{ host: '192.168.0.62' }, 504, 'TIMEOUT', /demorou/],
  ])('connect %j → %i %s com mensagem em português', async (body, status, code, msg) => {
    const r = await api(studio, 'POST', '/api/connect', body);
    expect(r.status).toBe(status);
    expect(r.body.error.code).toBe(code);
    expect(r.body.error.message).toMatch(msg);
  });

  it('inventário sem conectar → DEVICE_NOT_FOUND; TV que não autorizou → DEVICE_UNAUTHORIZED', async () => {
    const nf = await api(studio, 'POST', '/api/inventory', { serial: '192.168.0.52:5555' });
    expect(nf.body.error.code).toBe('DEVICE_NOT_FOUND');
    await api(studio, 'POST', '/api/connect', { host: '192.168.0.60' });
    const un = await api(studio, 'POST', '/api/inventory', { serial: '192.168.0.60:5555' });
    expect(un.body.error.code).toBe('DEVICE_UNAUTHORIZED');
    expect(un.body.error.message).toMatch(/Permitir depuração/);
  });

  it('serial com injeção é recusado antes de chegar ao adb', async () => {
    const r = await api(studio, 'POST', '/api/inventory', { serial: '192.168.0.50:5555; reboot' });
    expect(r.status).toBe(400);
  });

  it('pareamento: código inválido e correto', async () => {
    expect((await api(studio, 'POST', '/api/pair', { host: '192.168.0.51', port: 37000, code: '12' })).status).toBe(400);
    expect((await api(studio, 'POST', '/api/pair', { host: '192.168.0.51', port: 37000, code: '000000' })).body.error.code).toBe(
      'PAIRING_FAILED',
    );
    expect((await api(studio, 'POST', '/api/pair', { host: '192.168.0.51', port: 37000, code: '123456' })).body).toEqual({ ok: true });
  });
});

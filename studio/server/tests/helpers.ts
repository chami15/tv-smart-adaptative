import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createFakeNetwork, FAKE_NETWORK } from '@tvsa/core';
import { startStudio, type StudioServer } from '../src/app.ts';

export async function startFakeStudio(): Promise<StudioServer & { dataDir: string; webDir: string }> {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tvsa-srv-'));
  const webDir = path.join(dataDir, 'web');
  await fs.mkdir(webDir);
  await fs.writeFile(path.join(webDir, 'index.html'), '<!doctype html><title>Studio</title>');
  await fs.writeFile(path.join(webDir, 'app.js'), 'console.log(1)');
  await fs.writeFile(path.join(dataDir, 'segredo.txt'), 'não pode vazar');
  const studio = await startStudio({
    dataDir,
    webDir,
    transport: createFakeNetwork(),
    fakeNetwork: FAKE_NETWORK.map(({ host, scenario }) => ({ host, scenario })),
  });
  return Object.assign(studio, { dataDir, webDir });
}

export interface Reply {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: any;
  text: string;
}

export function request(
  port: number,
  opts: { method?: string; path: string; headers?: Record<string, string>; body?: string },
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, method: opts.method ?? 'GET', path: opts.path, headers: { host: `127.0.0.1:${port}`, ...opts.headers } },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (text += c));
        res.on('end', () => {
          let body: unknown = null;
          try {
            body = JSON.parse(text);
          } catch {
            /* não é JSON */
          }
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body, text });
        });
      },
    );
    req.on('error', reject);
    if (opts.body !== undefined) req.write(opts.body);
    req.end();
  });
}

export function api(studio: StudioServer, method: string, p: string, json?: unknown): Promise<Reply> {
  return request(studio.port, {
    method,
    path: p,
    headers: {
      authorization: `Bearer ${studio.token}`,
      ...(json !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  });
}

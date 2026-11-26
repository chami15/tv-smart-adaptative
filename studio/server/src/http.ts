// Servidor HTTP local do Studio. Segurança:
//  - escuta só em 127.0.0.1 (ninguém da rede acessa);
//  - Host e Origin precisam ser deste servidor (contra DNS rebinding e outros sites);
//  - toda rota /api exige o token da sessão (gerado a cada execução);
//  - POST só com JSON e corpo pequeno.
import { timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { AdbError, SnapshotError, USER_MESSAGES, isValidHost, isValidPairingCode, isValidPort, isValidSerial } from '@tvsa/core';
import type { StudioService } from './service.ts';

export interface HttpOptions {
  service: StudioService;
  token: string;
  webDir: string;
  /** Porta real (preenchida após o listen) usada para validar Host/Origin. */
  getPort: () => number;
}

class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
};

export function createHandler(opts: HttpOptions): http.RequestListener {
  return (req, res) => {
    handle(req, res, opts).catch((err) => sendError(res, err));
  };
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse, opts: HttpOptions): Promise<void> {
  const port = opts.getPort();
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  if (!allowedHosts.has(req.headers.host ?? '')) throw new HttpError(403, 'BAD_HOST', 'Acesso permitido apenas pelo endereço local.');
  const origin = req.headers.origin;
  if (origin !== undefined && !allowedHosts.has(origin.replace(/^http:\/\//, ''))) {
    throw new HttpError(403, 'BAD_ORIGIN', 'Origem não permitida.');
  }

  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
  if (url.pathname.startsWith('/api/')) return api(req, res, url, opts);
  if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'METHOD', 'Método não permitido.');
  return serveStatic(res, url.pathname, opts.webDir);
}

function checkToken(req: http.IncomingMessage, token: string): void {
  const header = req.headers.authorization ?? '';
  const given = Buffer.from(header.startsWith('Bearer ') ? header.slice(7) : '');
  const expected = Buffer.from(token);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new HttpError(401, 'NO_TOKEN', 'Sessão inválida. Abra o Studio pelo atalho "Iniciar-Studio".');
  }
}

async function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'CONTENT_TYPE', 'Envie os dados como JSON.');
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 16 * 1024) throw new HttpError(413, 'TOO_LARGE', 'Requisição grande demais.');
    chunks.push(chunk as Buffer);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'BAD_JSON', 'Dados inválidos.');
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function host(body: Record<string, unknown>): string {
  const h = str(body.host);
  if (!isValidHost(h)) throw new HttpError(400, 'INVALID_ARGUMENT', 'Endereço IP inválido. Exemplo: 192.168.0.25');
  return h;
}
function port(body: Record<string, unknown>, fallback?: number): number {
  const raw = body.port ?? fallback;
  const n = typeof raw === 'string' ? Number(raw.trim()) : raw;
  if (typeof n !== 'number' || !isValidPort(n)) throw new HttpError(400, 'INVALID_ARGUMENT', 'Porta inválida (1 a 65535).');
  return n;
}
function serial(body: Record<string, unknown>): string {
  const s = str(body.serial);
  if (!isValidSerial(s)) throw new HttpError(400, 'INVALID_ARGUMENT', 'TV inválida.');
  return s;
}

async function api(req: http.IncomingMessage, res: http.ServerResponse, url: URL, opts: HttpOptions): Promise<void> {
  checkToken(req, opts.token);
  const s = opts.service;
  const route = `${req.method} ${url.pathname}`;

  switch (route) {
    case 'GET /api/status':
      return sendJson(res, 200, await s.status());
    case 'GET /api/snapshots':
      return sendJson(res, 200, await s.snapshots());
  }

  if (req.method !== 'POST') throw new HttpError(404, 'NOT_FOUND', 'Rota inexistente.');
  const body = await readJson(req);

  switch (url.pathname) {
    case '/api/adb/recheck':
      s.setup();
      return sendJson(res, 200, await s.status());
    case '/api/connect':
      return sendJson(res, 200, await s.connect(host(body), port(body, 5555)));
    case '/api/pair': {
      const code = str(body.code);
      if (!isValidPairingCode(code)) throw new HttpError(400, 'INVALID_ARGUMENT', 'O código de pareamento tem 6 dígitos.');
      await s.pair(host(body), port(body), code);
      return sendJson(res, 200, { ok: true });
    }
    case '/api/disconnect':
      await s.disconnect(serial(body));
      return sendJson(res, 200, { ok: true });
    case '/api/inventory':
      return sendJson(res, 200, await s.inventory(serial(body)));
    case '/api/snapshot':
      return sendJson(res, 200, await s.snapshot(serial(body)));
  }
  throw new HttpError(404, 'NOT_FOUND', 'Rota inexistente.');
}

function serveStatic(res: http.ServerResponse, pathname: string, webDir: string): void {
  const root = path.resolve(webDir);
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    throw new HttpError(400, 'BAD_PATH', 'Caminho inválido.');
  }
  if (decoded.includes('\0')) throw new HttpError(400, 'BAD_PATH', 'Caminho inválido.');
  let file = path.resolve(root, '.' + path.posix.normalize('/' + decoded));
  if (file !== root && !file.startsWith(root + path.sep)) throw new HttpError(403, 'BAD_PATH', 'Caminho não permitido.');

  if (!isFile(file)) file = path.join(root, 'index.html'); // SPA
  if (!isFile(file)) {
    res.writeHead(500, { ...SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>Página do Studio não encontrada</h1><p>Rode <code>npm run build:web</code> ou use o atalho Iniciar-Studio.</p>');
    return;
  }
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Cache-Control': file.endsWith('index.html') ? 'no-store' : 'public, max-age=3600',
  });
  fs.createReadStream(file).pipe(res);
}

function isFile(f: string): boolean {
  try {
    return fs.statSync(f).isFile();
  } catch {
    return false;
  }
}

function sendJson(res: http.ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

const ADB_STATUS: Partial<Record<string, number>> = {
  ADB_NOT_FOUND: 503,
  COMMAND_REFUSED: 403,
  INVALID_ARGUMENT: 400,
  TIMEOUT: 504,
};

function sendError(res: http.ServerResponse, err: unknown): void {
  if (res.headersSent) return void res.end();
  if (err instanceof HttpError) return sendJson(res, err.status, { error: { code: err.code, message: err.message } });
  if (err instanceof SnapshotError) {
    return sendJson(res, 422, {
      error: { code: err.code, message: 'A leitura da TV veio incompleta, então o backup não foi salvo. Clique em "Ler de novo" e tente outra vez.' },
    });
  }
  if (err instanceof AdbError) {
    const message = err.code === 'INVALID_ARGUMENT' ? err.message : USER_MESSAGES[err.code];
    return sendJson(res, ADB_STATUS[err.code] ?? 502, { error: { code: err.code, message, detail: err.message } });
  }
  console.error('[studio] erro inesperado:', err);
  sendJson(res, 500, { error: { code: 'INTERNAL', message: 'Erro interno do Studio.' } });
}

import { randomBytes } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { createHandler } from './http.ts';
import { StudioService, type StudioServiceOptions } from './service.ts';

export const DEFAULT_WEB_DIR = fileURLToPath(new URL('../../web/dist/', import.meta.url));

export interface StudioServer {
  server: http.Server;
  service: StudioService;
  token: string;
  port: number;
  url: string;
  close: () => Promise<void>;
}

export async function startStudio(
  options: StudioServiceOptions & { port?: number; webDir?: string; token?: string },
): Promise<StudioServer> {
  const service = new StudioService(options);
  const token = options.token ?? randomBytes(24).toString('base64url');
  let actualPort = 0;
  const server = http.createServer(
    createHandler({ service, token, webDir: options.webDir ?? DEFAULT_WEB_DIR, getPort: () => actualPort }),
  );

  const listen = (port: number) =>
    new Promise<void>((resolve, reject) => {
      const onError = (err: Error) => {
        server.off('listening', onListening);
        reject(err);
      };
      const onListening = () => {
        server.off('error', onError);
        resolve();
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(port, '127.0.0.1'); // SOMENTE local
    });

  try {
    await listen(options.port ?? 0);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EADDRINUSE' || !options.port) throw err;
    await listen(0); // porta ocupada: usa qualquer livre
  }
  actualPort = (server.address() as AddressInfo).port;
  const url = `http://127.0.0.1:${actualPort}/#token=${token}`;
  return {
    server,
    service,
    token,
    port: actualPort,
    url,
    close: () => new Promise((r) => server.close(() => r())),
  };
}

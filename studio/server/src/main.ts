// Inicia o Studio: `npm start` (TV real) ou `npm run dev:fake` (rede simulada).
import { execFile } from 'node:child_process';
import path from 'node:path';
import { createFakeNetwork, defaultDataDir, FAKE_NETWORK } from '@tvsa/core';
import { startStudio } from './app.ts';

const args = new Set(process.argv.slice(2));
const fake = args.has('--fake');
const noOpen = args.has('--no-open') || process.env.TVSA_NO_OPEN === '1';
const portArg = process.argv.find((a) => a.startsWith('--port='));
const port = portArg ? Number(portArg.split('=')[1]) : 4780;

const baseDir = defaultDataDir();
const studio = await startStudio({
  port,
  dataDir: fake ? path.join(baseDir, 'modo-simulado') : baseDir,
  ...(fake
    ? { transport: createFakeNetwork({ latencyMs: 150 }), fakeNetwork: FAKE_NETWORK.map(({ host, scenario }) => ({ host, scenario })) }
    : {}),
});

console.log('');
console.log('  TV Smart Adaptative — Studio' + (fake ? ' (MODO SIMULADO: nenhuma TV real é usada)' : ''));
console.log(`  Abra no navegador: ${studio.url}`);
console.log('  Para encerrar, feche esta janela ou aperte Ctrl+C.');
console.log('');

if (!noOpen) openBrowser(studio.url);

function openBrowser(url: string): void {
  const [cmd, cmdArgs] =
    process.platform === 'win32'
      ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];
  execFile(cmd as string, cmdArgs as string[], { windowsHide: true }, (err) => {
    if (err) console.log('  (Não consegui abrir o navegador sozinho — copie o endereço acima.)');
  });
}

const shutdown = () => {
  studio.close().finally(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

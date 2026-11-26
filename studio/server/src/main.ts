// Inicia o Studio: `npm start` (TV real) ou `npm run dev:fake` (rede simulada).
import { execFile } from 'node:child_process';
import path from 'node:path';
import { createFakeNetwork, defaultDataDir, FAKE_NETWORK, fakeDiscovery } from '@tvsa/core';
import { startStudio } from './app.ts';

const args = new Set(process.argv.slice(2));
const fake = args.has('--fake');
const noOpen = args.has('--no-open') || process.env.TVSA_NO_OPEN === '1';
const portArg = process.argv.find((a) => a.startsWith('--port='));
const port = portArg ? Number(portArg.split('=')[1]) : 4780;

// TVSA_TOKEN: usado só pelos testes automatizados para saber o token da sessão.
const fixedToken = process.env.TVSA_TOKEN && /^[A-Za-z0-9_-]{16,}$/.test(process.env.TVSA_TOKEN) ? process.env.TVSA_TOKEN : undefined;

const baseDir = defaultDataDir();
// Liberação de mudanças na TV REAL (decisão do usuário). Simulado: sempre liberado.
const allowRealWrites = process.env.TVSA_ALLOW_REAL_WRITES === '1';

const studio = await startStudio({
  port,
  allowRealWrites,
  stepDelayMs: fake ? 250 : 400,
  ...(fixedToken ? { token: fixedToken } : {}),
  dataDir: fake ? path.join(baseDir, 'modo-simulado') : baseDir,
  ...(fake
    ? {
        transport: createFakeNetwork({ latencyMs: 150 }),
        fakeNetwork: FAKE_NETWORK.map(({ host, scenario }) => ({ host, scenario })),
        discover: async () => (await new Promise((r) => setTimeout(r, 900)), fakeDiscovery()),
      }
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

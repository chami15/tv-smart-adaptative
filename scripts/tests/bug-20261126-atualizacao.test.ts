// BUG 2026-11-26 — relatado pelo usuário (Windows): depois de "git pull" o Studio continuou com a tela antiga.
// Causas: (1) o Studio aberto não avisa que há versão nova no disco; (2) Iniciar-Studio.cmd só instalava
// dependências na primeira vez, então uma biblioteca nova (dns-packet) faltaria ao reabrir.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { dependencyProblems } from '../preflight-lib.mjs';

const root = path.resolve(import.meta.dirname, '../..');

it('preflight: repositório instalado corretamente não tem problemas', () => {
  expect(dependencyProblems(root)).toEqual([]);
});

it('preflight: detecta dependência nova que ainda não foi instalada', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tvsa-pre-'));
  fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ dependencies: { 'pacote-que-nao-existe': '^1.0.0' } }));
  fs.mkdirSync(path.join(tmp, 'node_modules'));
  expect(dependencyProblems(tmp)).toEqual([expect.stringContaining('pacote-que-nao-existe')]);
  fs.rmSync(tmp, { recursive: true, force: true });
});

it('preflight: detecta package-lock.json mais novo que a instalação (git pull trouxe mudanças)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tvsa-pre-'));
  fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({}));
  fs.mkdirSync(path.join(tmp, 'node_modules'));
  fs.writeFileSync(path.join(tmp, 'node_modules', '.package-lock.json'), '{}');
  fs.writeFileSync(path.join(tmp, 'package-lock.json'), '{}');
  const old = new Date(Date.now() - 60_000);
  fs.utimesSync(path.join(tmp, 'node_modules', '.package-lock.json'), old, old);
  expect(dependencyProblems(tmp)).toEqual([expect.stringContaining('package-lock.json')]);
  fs.rmSync(tmp, { recursive: true, force: true });
});

it('npm start passa pelo preflight antes de montar a página', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  expect(pkg.scripts.start).toMatch(/^node scripts\/preflight\.mjs && /);
  expect(pkg.scripts['dev:fake']).toMatch(/^node scripts\/preflight\.mjs && /);
});

// BUG 2026-11-26 (2) — "git pull" abortava: o npm install no Windows reescrevia o package-lock.json.
it('instalação automática usa "npm ci" (nunca reescreve o package-lock.json)', () => {
  const preflight = fs.readFileSync(path.join(root, 'scripts', 'preflight.mjs'), 'utf8');
  expect(preflight).toContain("['ci', ");
  expect(preflight).not.toMatch(/\['install'/);
  const start = fs.readFileSync(path.join(root, 'Iniciar-Studio.cmd'), 'utf8');
  expect(start).not.toMatch(/npm install/);
});

it('Atualizar-Studio.cmd descarta só o package-lock.json, atualiza e instala com npm ci', () => {
  const cmd = fs.readFileSync(path.join(root, 'Atualizar-Studio.cmd'), 'utf8');
  expect(cmd).toContain('git checkout -- package-lock.json');
  expect(cmd.indexOf('git checkout -- package-lock.json')).toBeLessThan(cmd.indexOf('git pull'));
  expect(cmd).toMatch(/npm ci/);
  expect(cmd).not.toMatch(/git (reset|clean|stash)/); // nunca apaga mudanças do usuário
});

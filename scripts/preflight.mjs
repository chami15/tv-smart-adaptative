// Roda antes de "npm start": confere o Node e instala sozinho o que faltar depois de uma atualização.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { dependencyProblems, markInstalled, nodeVersionProblem } from './preflight-lib.mjs';

const root = path.resolve(import.meta.dirname, '..');

const nodeProblem = nodeVersionProblem();
if (nodeProblem) {
  console.error(`\n  ${nodeProblem}\n  Baixe a versão LTS em https://nodejs.org e tente de novo.\n`);
  process.exit(1);
}

let problems = dependencyProblems(root);
if (problems.length) {
  console.log('\n  O projeto foi atualizado ou ainda não está instalado:');
  for (const p of problems) console.log(`   - ${p}`);
  console.log('  Instalando o que falta (pode levar alguns minutos)...\n');
  const r = spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status === 0) markInstalled(root);
  problems = dependencyProblems(root);
  if (r.status !== 0 || problems.length) {
    console.error('\n  Não consegui instalar as dependências. Verifique a internet e rode "npm ci" na pasta do projeto.\n');
    process.exit(1);
  }
}

// Verificações antes de abrir o Studio. JavaScript puro e sem dependências:
// precisa funcionar mesmo quando o node_modules está desatualizado ou quebrado.
import fs from 'node:fs';
import path from 'node:path';

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

/** Lista de problemas de instalação (vazia = tudo certo). */
export function dependencyProblems(root) {
  const problems = [];
  const nodeModules = path.join(root, 'node_modules');
  if (!fs.existsSync(nodeModules)) return ['As dependências ainda não foram instaladas.'];

  const rootPkg = readJson(path.join(root, 'package.json'));
  const dirs = [root, ...(rootPkg.workspaces ?? []).map((w) => path.join(root, w))];
  for (const dir of dirs) {
    let pkg;
    try {
      pkg = readJson(path.join(dir, 'package.json'));
    } catch {
      continue;
    }
    for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
      const found = [nodeModules, path.join(dir, 'node_modules')].some((nm) => fs.existsSync(path.join(nm, name, 'package.json')));
      if (!found) problems.push(`Falta a biblioteca "${name}".`);
    }
  }

  const lock = path.join(root, 'package-lock.json');
  const installed = path.join(nodeModules, '.package-lock.json');
  if (fs.existsSync(lock) && fs.existsSync(installed) && fs.statSync(lock).mtimeMs > fs.statSync(installed).mtimeMs + 1000) {
    problems.push('O package-lock.json mudou depois da última instalação (atualização do projeto).');
  }
  return problems;
}

export function nodeVersionProblem(version = process.versions.node) {
  const [maj, min] = version.split('.').map(Number);
  return maj > 22 || (maj === 22 && min >= 18) ? null : `O Studio precisa do Node.js 22.18 ou mais novo (você tem ${version}).`;
}

/** Marca a instalação como em dia (evita reinstalar a cada abertura quando o npm não mexe no arquivo). */
export function markInstalled(root) {
  const installed = path.join(root, 'node_modules', '.package-lock.json');
  if (fs.existsSync(installed)) {
    const now = new Date();
    fs.utimesSync(installed, now, now);
  }
}

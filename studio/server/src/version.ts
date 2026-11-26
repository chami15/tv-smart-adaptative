import fs from 'node:fs';
import path from 'node:path';

/**
 * Identifica a versão do código no disco: o commit atual do git (7 caracteres) ou,
 * para quem baixou o ZIP, a versão do package.json + data do package-lock.json.
 */
export function readCodeVersion(root: string): string {
  try {
    const head = fs.readFileSync(path.join(root, '.git', 'HEAD'), 'utf8').trim();
    if (!head.startsWith('ref:')) return head.slice(0, 7);
    const ref = head.slice(4).trim();
    const refFile = path.join(root, '.git', ...ref.split('/'));
    if (fs.existsSync(refFile)) return fs.readFileSync(refFile, 'utf8').trim().slice(0, 7);
    const packed = fs.readFileSync(path.join(root, '.git', 'packed-refs'), 'utf8');
    const line = packed.split('\n').find((l) => l.endsWith(' ' + ref));
    if (line) return line.slice(0, 7);
  } catch {
    /* sem git: cai no package.json */
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { version?: string };
    const lock = fs.statSync(path.join(root, 'package-lock.json')).mtimeMs;
    return `v${pkg.version ?? '0'}-${Math.round(lock / 1000).toString(36)}`;
  } catch {
    return 'desconhecida';
  }
}

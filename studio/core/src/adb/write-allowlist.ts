// ALLOWLIST DE ESCRITA — separada da de leitura e usada SOMENTE pelo executor de planos aprovados.
// Só ações reversíveis: desativar (pm disable-user) e reativar (pm enable). Nada de desinstalar/apagar.
// Alterar esta lista exige atualizar docs/SEGURANCA.md e os testes.
import { isCoreProtected } from '../catalog/index.ts';
import { isShellSafeToken, isValidPackageName, isValidSerial } from './validate.ts';

export type WriteDecision = { allowed: true; kind: 'disable' | 'enable'; pkg: string } | { allowed: false; reason: string };

export function writeArgs(serial: string, kind: 'disable' | 'enable', pkg: string): string[] {
  return kind === 'disable'
    ? ['-s', serial, 'shell', 'pm', 'disable-user', '--user', '0', pkg]
    : ['-s', serial, 'shell', 'pm', 'enable', pkg];
}

export function checkWriteAllowlist(args: readonly string[]): WriteDecision {
  if (args.some((a) => !isShellSafeToken(a))) return { allowed: false, reason: 'argumento com caractere não permitido' };
  if (args[0] !== '-s' || !isValidSerial(args[1] ?? '')) return { allowed: false, reason: 'escrita exige TV identificada' };
  const rest = args.slice(2);
  let kind: 'disable' | 'enable' | null = null;
  let pkg = '';
  if (rest.length === 6 && rest.slice(0, 5).join(' ') === 'shell pm disable-user --user 0') {
    kind = 'disable';
    pkg = rest[5]!;
  } else if (rest.length === 4 && rest.slice(0, 3).join(' ') === 'shell pm enable') {
    kind = 'enable';
    pkg = rest[3]!;
  }
  if (!kind) return { allowed: false, reason: `comando de escrita fora da allowlist: adb ${args.join(' ')}` };
  if (!isValidPackageName(pkg)) return { allowed: false, reason: `nome de app inválido: ${pkg}` };
  if (kind === 'disable' && isCoreProtected(pkg)) return { allowed: false, reason: `app intocável: ${pkg}` };
  return { allowed: true, kind, pkg };
}

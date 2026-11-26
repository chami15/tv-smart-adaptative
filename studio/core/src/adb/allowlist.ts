// ALLOWLIST da camada ADB — Fase 1: SOMENTE LEITURA.
// Qualquer comando que não case exatamente com uma regra abaixo é recusado.
// Para adicionar uma regra é obrigatório: atualizar docs/SEGURANCA.md e criar testes.
import {
  isShellSafeToken,
  isValidHostPort,
  isValidPairingCode,
  isValidPropKey,
  isValidSerial,
} from './validate.ts';

export type AllowlistDecision = { allowed: true; rule: string } | { allowed: false; reason: string };

type Rule = { name: string; needsSerial: boolean; match: (args: readonly string[]) => boolean };

const PM_LIST_FLAGS = new Set(['-s', '-3', '-d', '-e', '-f', '-U']);
const HOME_QUERY = [
  'shell', 'cmd', 'package', 'resolve-activity', '--brief',
  '-a', 'android.intent.action.MAIN', '-c', 'android.intent.category.HOME',
];

const eq = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

export const RULES: readonly Rule[] = [
  { name: 'version', needsSerial: false, match: (a) => eq(a, ['version']) },
  { name: 'devices', needsSerial: false, match: (a) => eq(a, ['devices']) || eq(a, ['devices', '-l']) },
  { name: 'connect', needsSerial: false, match: (a) => a.length === 2 && a[0] === 'connect' && isValidHostPort(a[1]!) },
  {
    name: 'disconnect',
    needsSerial: false,
    match: (a) => eq(a, ['disconnect']) || (a.length === 2 && a[0] === 'disconnect' && isValidHostPort(a[1]!)),
  },
  {
    name: 'pair',
    needsSerial: false,
    match: (a) => a.length === 3 && a[0] === 'pair' && isValidHostPort(a[1]!) && isValidPairingCode(a[2]!),
  },
  { name: 'get-state', needsSerial: true, match: (a) => eq(a, ['get-state']) },
  {
    name: 'getprop',
    needsSerial: true,
    match: (a) => eq(a, ['shell', 'getprop']) || (a.length === 3 && a[0] === 'shell' && a[1] === 'getprop' && isValidPropKey(a[2]!)),
  },
  {
    name: 'pm-list-packages',
    needsSerial: true,
    match: (a) => {
      if (!eq(a.slice(0, 4), ['shell', 'pm', 'list', 'packages'])) return false;
      const flags = a.slice(4);
      return flags.every((f) => PM_LIST_FLAGS.has(f)) && new Set(flags).size === flags.length;
    },
  },
  { name: 'pm-list-features', needsSerial: true, match: (a) => eq(a, ['shell', 'pm', 'list', 'features']) },
  { name: 'proc-meminfo', needsSerial: true, match: (a) => eq(a, ['shell', 'cat', '/proc/meminfo']) },
  { name: 'dumpsys-meminfo', needsSerial: true, match: (a) => eq(a, ['shell', 'dumpsys', 'meminfo']) },
  { name: 'wm-size', needsSerial: true, match: (a) => eq(a, ['shell', 'wm', 'size']) },
  { name: 'wm-density', needsSerial: true, match: (a) => eq(a, ['shell', 'wm', 'density']) },
  { name: 'resolve-home', needsSerial: true, match: (a) => eq(a, HOME_QUERY) },
];

/** Decide se a lista de argumentos (exatamente como será passada ao adb) é permitida. */
export function checkAllowlist(args: readonly string[]): AllowlistDecision {
  if (args.length === 0) return { allowed: false, reason: 'comando vazio' };
  const bad = args.find((t) => !isShellSafeToken(t));
  if (bad !== undefined) return { allowed: false, reason: `argumento com caractere não permitido: ${JSON.stringify(bad)}` };

  let rest = args;
  let hasSerial = false;
  if (args[0] === '-s') {
    if (args.length < 3 || !isValidSerial(args[1]!)) return { allowed: false, reason: 'serial inválido' };
    rest = args.slice(2);
    hasSerial = true;
  }

  for (const rule of RULES) {
    if (rule.needsSerial !== hasSerial) continue;
    if (rule.match(rest)) return { allowed: true, rule: rule.name };
  }
  return { allowed: false, reason: `comando fora da allowlist: adb ${args.join(' ')}` };
}

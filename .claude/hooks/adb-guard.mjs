#!/usr/bin/env node
// Hook PreToolUse (Bash): bloqueia comandos adb/fastboot que possam danificar a TV.
// Regras em docs/SEGURANCA.md. Saída 2 = bloqueia e mostra o motivo ao Claude.

import { pathToFileURL } from 'node:url';

// Único app que o projeto pode desinstalar: o próprio launcher.
export const OWN_PACKAGES = ['com.tvsmartadaptative.launcher'];

// Pacotes que nunca podem ser desabilitados (subconjunto de docs/SEGURANCA.md §3).
export const PROTECTED_PACKAGES = [
  /^android$/,
  /^com\.android\.systemui$/,
  /^com\.android\.settings$/,
  /^com\.android\.tv\.settings$/,
  /^com\.android\.providers\./,
  /^com\.(google\.)?android\.packageinstaller$/,
  /^com\.android\.shell$/,
  /^com\.android\.networkstack/,
  /^com\.android\.wifi/,
  /^com\.android\.bluetooth$/,
  /^com\.google\.android\.gms$/,
  /^com\.google\.android\.gsf$/,
  /^com\.google\.android\.tv\.remote\.service$/,
  /^com\.tcl\.tv$/,
  /^com\.tcl\.tvinput$/,
];

const ADB_RE = /(^|[\s/\\"'`(])(adb|fastboot)(\.exe)?(?=\s|$|["'`)])/i;

// Padrões proibidos dentro de um trecho que invoca adb.
const FORBIDDEN = [
  [/(^|[\s/\\"'`(])fastboot(\.exe)?(\s|$)/i, 'fastboot mexe no bootloader/partições'],
  [/\badb(\.exe)?\b.*\s(root|unroot|remount|disable-verity|enable-verity|sideload)\b/i, 'comando adb privilegiado ou de gravação de sistema'],
  [/\breboot\s+(bootloader|recovery|fastboot|edl|sideload|download)\b/i, 'reiniciar em modo de bootloader/recovery'],
  [/(^|[\s"'`;&|(])su(\s|$|["'`;&|)])/, 'uso de root (su)'],
  [/(^|[\s"'`;&|(])(rm|dd|mkfs[\w.]*|wipe|format|flash_image|mke2fs)(\s|$|["'`;&|)])/, 'apagar/gravar arquivos ou partições'],
  [/\b(pm|cmd\s+package)\s+uninstall\b/, 'desinstalar pacote (use pm disable-user)'],
  [/\bpm\s+clear\b/, 'apagar dados de app'],
  [/\bsettings\s+(put|delete|reset)\b/, 'alterar configurações do sistema'],
  [/\bsetprop\b/, 'alterar propriedades do sistema'],
  [/\bsvc\s+(wifi|data|bluetooth|ethernet|power)\b/, 'alterar rede/energia da TV'],
  [/\b(cmd\s+)?wifi\s+(connect|forget|set|disable)/, 'alterar Wi-Fi da TV'],
  [/\bam\s+broadcast\b.*(MASTER_CLEAR|FACTORY_RESET)/i, 'reset de fábrica'],
  [/\brecovery\b/, 'operação de recovery'],
];

/** Divide em trechos por ; && || | e quebra de linha, respeitando aspas. */
export function splitSegments(command) {
  const segments = [];
  let current = '';
  let quote = null;
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote) {
      if (ch === quote) quote = null;
      current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; current += ch; continue; }
    if (ch === ';' || ch === '\n' || ch === '|' || ch === '&') {
      if (current.trim()) segments.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) segments.push(current.trim());
  return segments;
}

/** Retorna { blocked: boolean, reason?: string } */
export function checkCommand(command) {
  if (typeof command !== 'string' || !ADB_RE.test(command)) return { blocked: false };

  for (const seg of splitSegments(command)) {
    if (!ADB_RE.test(seg)) continue;

    for (const [re, reason] of FORBIDDEN) {
      if (re.test(seg)) return { blocked: true, reason: `${reason}: "${seg}"` };
    }

    // adb uninstall só do próprio launcher
    const un = seg.match(/\badb(?:\.exe)?\b.*\suninstall\s+(?:-k\s+)?(\S+)/i);
    if (un && !OWN_PACKAGES.includes(un[1].replace(/["']/g, ''))) {
      return { blocked: true, reason: `só é permitido desinstalar o próprio launcher: "${seg}"` };
    }

    // pm disable / hide de pacote intocável
    const dis = seg.match(/\bpm\s+(?:disable(?:-user)?|hide|suspend)\b(?:\s+--user\s+\d+)?\s+([\w.]+)/);
    if (dis && PROTECTED_PACKAGES.some((re) => re.test(dis[1]))) {
      return { blocked: true, reason: `pacote intocável (docs/SEGURANCA.md §3): ${dis[1]}` };
    }
    if (/\bpm\s+(hide|suspend)\b/.test(seg)) {
      return { blocked: true, reason: `use apenas pm disable-user (reversível): "${seg}"` };
    }

    // shell interativo ou alimentado por arquivo não pode ser auditado
    if (/\badb(?:\.exe)?\b(\s+-\w+(\s+\S+)?)*\s+shell\s*(<|$)/i.test(seg)) {
      return { blocked: true, reason: `adb shell sem comando explícito não pode ser auditado: "${seg}"` };
    }
  }
  return { blocked: false };
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let command = '';
  try {
    command = JSON.parse(raw)?.tool_input?.command ?? '';
  } catch {
    process.exit(0); // entrada inesperada: não interfere
  }
  const result = checkCommand(command);
  if (result.blocked) {
    process.stderr.write(
      `Bloqueado pelo adb-guard (docs/SEGURANCA.md): ${result.reason}\n` +
        'Se for realmente necessário, explique ao usuário e peça que ele execute manualmente.\n',
    );
    process.exit(2);
  }
  process.exit(0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();

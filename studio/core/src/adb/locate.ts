import path from 'node:path';

export interface LocateEnv {
  platform: NodeJS.Platform;
  env: Record<string, string | undefined>;
  exists: (file: string) => boolean;
}

/**
 * Procura o adb: variável TVSA_ADB_PATH → caminho configurado → PATH → locais comuns no Windows.
 * Retorna o caminho absoluto ou null.
 */
export function locateAdb(ctx: LocateEnv, configuredPath?: string): string | null {
  const isWin = ctx.platform === 'win32';
  const p = isWin ? path.win32 : path.posix;
  const exe = isWin ? 'adb.exe' : 'adb';
  const candidates: string[] = [];

  const fromEnv = ctx.env.TVSA_ADB_PATH;
  if (fromEnv) candidates.push(fromEnv);
  if (configuredPath) candidates.push(configuredPath);

  const pathVar = ctx.env.PATH ?? ctx.env.Path ?? '';
  for (const dir of pathVar.split(isWin ? ';' : ':')) {
    const d = dir.trim().replace(/^"(.*)"$/, '$1');
    if (d) candidates.push(p.join(d, exe));
  }

  if (isWin) {
    const local = ctx.env.LOCALAPPDATA;
    const home = ctx.env.USERPROFILE;
    if (local) candidates.push(p.join(local, 'Android', 'Sdk', 'platform-tools', exe));
    if (home) {
      candidates.push(p.join(home, 'platform-tools', exe));
      candidates.push(p.join(home, 'Downloads', 'platform-tools', exe));
      candidates.push(p.join(home, 'TVSmartAdaptative', 'platform-tools', exe));
    }
    candidates.push('C:\\platform-tools\\adb.exe', 'C:\\adb\\adb.exe');
  } else {
    const home = ctx.env.HOME;
    if (home) {
      candidates.push(p.join(home, 'Android', 'Sdk', 'platform-tools', exe));
      candidates.push(p.join(home, 'Library', 'Android', 'sdk', 'platform-tools', exe));
      candidates.push(p.join(home, 'platform-tools', exe));
    }
  }

  for (const c of candidates) {
    // um caminho que aponte para pasta: aceita a pasta do platform-tools também
    if (ctx.exists(c)) return c;
    const inDir = p.join(c, exe);
    if (!c.toLowerCase().endsWith(exe) && ctx.exists(inDir)) return inDir;
  }
  return null;
}

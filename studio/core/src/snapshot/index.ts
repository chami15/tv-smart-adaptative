import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { DeviceInventory } from '../inventory/collect.ts';

export const SNAPSHOT_SCHEMA_VERSION = 1;

/** Pasta de dados do usuário: %USERPROFILE%\TVSmartAdaptative (ou TVSA_HOME). Nunca dentro do repositório. */
export function defaultDataDir(env: Record<string, string | undefined> = process.env, home = os.homedir()): string {
  return env.TVSA_HOME && env.TVSA_HOME.trim() ? env.TVSA_HOME : path.join(home, 'TVSmartAdaptative');
}

const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;

/** Transforma um texto em nome de pasta válido no Windows, macOS e Linux. */
export function safeSegment(input: string, fallback = 'item'): string {
  let s = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-. ]+$/g, '')
    .slice(0, 60);
  if (!s) s = fallback;
  if (RESERVED.test(s)) s = `_${s}`;
  return s;
}

export function timestampFolder(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}`;
}

export function deviceFolder(inv: DeviceInventory): string {
  return safeSegment(`${inv.device.brand}-${inv.device.model}-${inv.deviceId}`, inv.deviceId);
}

export interface SnapshotResult {
  dir: string;
  files: string[];
}

export interface SnapshotFile {
  kind: 'tvsa-snapshot';
  schemaVersion: number;
  createdAt: string;
  reason: string;
  inventory: DeviceInventory;
}

/** Grava o snapshot. Nunca sobrescreve: se a pasta existir, cria "-2", "-3"... */
export async function writeSnapshot(
  inv: DeviceInventory,
  dataDir: string,
  options: { now?: Date; reason?: string } = {},
): Promise<SnapshotResult> {
  const now = options.now ?? new Date();
  const base = path.join(dataDir, 'backups', deviceFolder(inv));
  await fs.mkdir(base, { recursive: true });

  let dir = path.join(base, timestampFolder(now));
  for (let n = 2; ; n++) {
    try {
      await fs.mkdir(dir); // falha se já existir
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      dir = path.join(base, `${timestampFolder(now)}-${n}`);
      if (n > 1000) throw new Error('muitos snapshots no mesmo segundo');
    }
  }

  const snapshot: SnapshotFile = {
    kind: 'tvsa-snapshot',
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    createdAt: now.toISOString(),
    reason: options.reason ?? 'manual',
    inventory: inv,
  };
  const jsonFile = path.join(dir, 'snapshot.json');
  const txtFile = path.join(dir, 'apps.txt');
  await fs.writeFile(jsonFile, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' });
  await fs.writeFile(txtFile, renderPackagesText(inv, now), { flag: 'wx' });
  return { dir, files: [jsonFile, txtFile] };
}

function renderPackagesText(inv: DeviceInventory, now: Date): string {
  const lines = [
    `TV Smart Adaptative — backup de ${now.toLocaleString('pt-BR')}`,
    `${inv.device.brand} ${inv.device.model} · ${inv.device.platformLabel} · Android ${inv.device.androidVersion}`,
    `Tela inicial atual: ${inv.currentHome?.package ?? 'desconhecida'}`,
    '',
    'ESTADO  TIPO     APP',
  ];
  for (const p of inv.packages) {
    lines.push(`${p.enabled ? 'ativo  ' : 'DESATIV'} ${p.system ? 'sistema' : 'usuário'}  ${p.name}`);
  }
  return lines.join('\r\n') + '\r\n'; // CRLF: abre certinho no Bloco de Notas
}

export interface SnapshotSummary {
  dir: string;
  createdAt: string;
  device: string;
}

/** Lista snapshots existentes (do mais novo para o mais antigo). Ignora arquivos inválidos. */
export async function listSnapshots(dataDir: string): Promise<SnapshotSummary[]> {
  const root = path.join(dataDir, 'backups');
  const out: SnapshotSummary[] = [];
  let devices: string[] = [];
  try {
    devices = await fs.readdir(root);
  } catch {
    return [];
  }
  for (const d of devices) {
    let entries: string[] = [];
    try {
      entries = await fs.readdir(path.join(root, d));
    } catch {
      continue;
    }
    for (const e of entries) {
      const dir = path.join(root, d, e);
      try {
        const data = JSON.parse(await fs.readFile(path.join(dir, 'snapshot.json'), 'utf8')) as SnapshotFile;
        if (data.kind !== 'tvsa-snapshot') continue;
        out.push({ dir, createdAt: data.createdAt, device: `${data.inventory.device.brand} ${data.inventory.device.model}` });
      } catch {
        /* pasta sem snapshot válido */
      }
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

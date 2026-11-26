// Diário de execução: gravado no PC ANTES e DEPOIS de cada passo. Se o Studio, o PC ou a TV
// caírem no meio, ao reabrir o Studio sabe exatamente o que desfazer.
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ActionKind, ChangePlan } from './plan.ts';

export type StepStatus = 'pending' | 'started' | 'done' | 'failed' | 'undone' | 'undo-skipped' | 'undo-failed';
export type JournalStatus = 'running' | 'completed' | 'rolled-back' | 'rollback-failed' | 'interrupted';

export interface JournalStep {
  kind: ActionKind;
  pkg: string;
  label: string;
  status: StepStatus;
  error?: string;
}

export interface Journal {
  schemaVersion: 1;
  planId: string;
  plan: ChangePlan;
  deviceId: string;
  status: JournalStatus;
  snapshotDir: string;
  steps: JournalStep[];
  startedAt: string;
  updatedAt: string;
  message?: string;
}

/** Diários que precisam de atenção (mudança que não terminou certinho). */
export const NEEDS_ATTENTION: ReadonlySet<JournalStatus> = new Set(['running', 'interrupted', 'rollback-failed']);

export class JournalStore {
  readonly dir: string;
  constructor(dataDir: string) {
    this.dir = path.join(dataDir, 'journal');
  }

  private file(planId: string): string {
    if (!/^[0-9a-f-]{36}$/.test(planId)) throw new Error('id de plano inválido');
    return path.join(this.dir, `${planId}.json`);
  }

  /** Gravação atômica: escreve num arquivo temporário e renomeia (com novas tentativas no Windows). */
  async save(j: Journal): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    j.updatedAt = new Date().toISOString();
    const target = this.file(j.planId);
    const tmp = `${target}.${randomBytes(4).toString('hex')}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(j, null, 2));
    for (let attempt = 0; ; attempt++) {
      try {
        await fs.rename(tmp, target);
        return;
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (attempt >= 6 || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) {
          await fs.rm(tmp, { force: true });
          throw err;
        }
        await new Promise((r) => setTimeout(r, 40 * (attempt + 1))); // antivírus segurando o arquivo
      }
    }
  }

  async load(planId: string): Promise<Journal | null> {
    try {
      return JSON.parse(await fs.readFile(this.file(planId), 'utf8')) as Journal;
    } catch {
      return null;
    }
  }

  async list(): Promise<Journal[]> {
    let files: string[];
    try {
      files = (await fs.readdir(this.dir)).filter((f) => f.endsWith('.json'));
    } catch {
      return [];
    }
    const out: Journal[] = [];
    for (const f of files) {
      try {
        out.push(JSON.parse(await fs.readFile(path.join(this.dir, f), 'utf8')) as Journal);
      } catch {
        /* diário corrompido: ignorado na listagem */
      }
    }
    return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async needingAttention(deviceId?: string): Promise<Journal[]> {
    return (await this.list()).filter((j) => NEEDS_ATTENTION.has(j.status) && (!deviceId || j.deviceId === deviceId));
  }
}

// Orquestra o core para a API: encontra o adb, conecta, lê inventário e salva snapshots.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readCodeVersion } from './version.ts';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
import {
  AdbError,
  AdbExecutor,
  type AdbDeviceEntry,
  type AdbTransport,
  AndroidFamilyDriver,
  buildPlan,
  buildRestorePlan,
  type Catalog,
  type ChangePlan,
  classifyPackage,
  deviceContext,
  discoverTvs,
  executePlan,
  type ExecutionResult,
  JournalStore,
  loadCatalog,
  loadSnapshot,
  type Rejection,
  rollbackIncomplete,
  type SafetyLevel,
  type DiscoveryResult,
  type DeviceInventory,
  listSnapshots,
  locateAdb,
  RealAdbTransport,
  type SnapshotSummary,
  writeSnapshot,
} from '@tvsa/core';

export interface StudioServiceOptions {
  dataDir: string;
  /** Transporte fixo (modo simulado / testes). Se ausente, procura o adb real. */
  transport?: AdbTransport;
  fakeNetwork?: readonly { host: string; scenario: string }[];
  /** Busca de TVs na rede; o padrão é a busca real. */
  discover?: () => Promise<DiscoveryResult>;
  /** Versão do código no disco (padrão: commit do git). Lida de novo a cada status. */
  getVersion?: () => string;
  /** Força o modo "TV real" mesmo com transporte injetado (usado em testes da trava). */
  simulated?: boolean;
  /** Na TV REAL, mudanças só com esta liberação (decisão do usuário). Na simulada, sempre liberado. */
  allowRealWrites?: boolean;
  /** Pausa entre passos na TV real (ms). */
  stepDelayMs?: number;
}

/** Erro de regra do Studio (não do adb), com status HTTP e mensagem em português. */
export class ServiceError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface CleanupItem {
  pkg: string;
  label: string;
  level: SafetyLevel;
  description?: string;
  effect?: string;
  enabled: boolean;
  memoryKb: number | null;
}

export interface PendingChange {
  planId: string;
  title: string;
  deviceId: string;
  status: string;
  message?: string;
  startedAt: string;
}

const PLAN_TTL_MS = 15 * 60 * 1000;

export interface StudioStatus {
  mode: 'real' | 'fake';
  adb: { found: boolean; path: string | null; version: string | null };
  devices: AdbDeviceEntry[];
  dataDir: string;
  fakeNetwork?: readonly { host: string; scenario: string }[];
  /** updateAvailable: o código foi atualizado (ex.: git pull) depois que o Studio abriu. */
  version: { running: string; onDisk: string; updateAvailable: boolean };
  writes: { allowed: boolean; reason?: string };
}

export class StudioService {
  private readonly options: StudioServiceOptions;
  private adbPath: string | null = null;
  private executor: AdbExecutor | null = null;
  private version: string | null = null;
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly lastInventory = new Map<string, DeviceInventory>();
  private readonly getVersion: () => string;
  private readonly catalog: Catalog = loadCatalog();
  private readonly plans = new Map<string, ChangePlan>();
  private readonly journals: JournalStore;
  private readonly runningVersion: string;

  constructor(options: StudioServiceOptions) {
    this.options = options;
    this.getVersion = options.getVersion ?? (() => readCodeVersion(REPO_ROOT));
    this.runningVersion = this.getVersion();
    this.journals = new JournalStore(options.dataDir);
    this.setup();
  }

  get mode(): 'real' | 'fake' {
    return (this.options.simulated ?? !!this.options.transport) ? 'fake' : 'real';
  }

  /** (Re)procura o adb no computador. */
  setup(): void {
    if (this.options.transport) {
      this.adbPath = '(simulado)';
      this.executor = new AdbExecutor(this.options.transport);
      return;
    }
    this.adbPath = locateAdb({ platform: process.platform, env: process.env, exists: (f) => isFile(f) });
    this.executor = this.adbPath ? new AdbExecutor(new RealAdbTransport(this.adbPath)) : null;
    this.version = null;
  }

  private adb(): AdbExecutor {
    if (!this.executor) throw new AdbError('ADB_NOT_FOUND', 'adb não encontrado');
    return this.executor;
  }

  /** Evita trabalho duplicado (ex.: dois cliques rápidos em "Conectar"). */
  private once<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const running = this.inflight.get(key);
    if (running) return running as Promise<T>;
    const p = fn().finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  async status(): Promise<StudioStatus> {
    let devices: AdbDeviceEntry[] = [];
    if (this.executor) {
      try {
        this.version ??= await this.executor.version();
        devices = await this.executor.devices();
      } catch (err) {
        if (err instanceof AdbError && err.code === 'ADB_NOT_FOUND') {
          this.executor = null;
          this.adbPath = null;
        } else throw err;
      }
    }
    return {
      mode: this.mode,
      adb: { found: this.executor !== null, path: this.adbPath, version: this.version },
      devices,
      dataDir: this.options.dataDir,
      version: this.versionInfo(),
      writes: this.writesInfo(),
      ...(this.options.fakeNetwork ? { fakeNetwork: this.options.fakeNetwork } : {}),
    };
  }

  private writesInfo(): StudioStatus['writes'] {
    if (this.mode === 'fake' || this.options.allowRealWrites) return { allowed: true };
    return {
      allowed: false,
      reason: 'Na sua TV real, aplicar mudanças ainda está bloqueado. Você já pode montar e revisar o plano; o botão "Aplicar" é liberado quando você aprovar.',
    };
  }

  private versionInfo(): StudioStatus['version'] {
    let onDisk = this.runningVersion;
    try {
      onDisk = this.getVersion();
    } catch {
      /* sem como ler: assume igual */
    }
    return { running: this.runningVersion, onDisk, updateAvailable: onDisk !== this.runningVersion };
  }

  connect(host: string, port: number): Promise<{ serial: string; already: boolean }> {
    return this.once(`connect:${host}:${port}`, () => this.adb().connect(host, port));
  }

  pair(host: string, port: number, code: string): Promise<void> {
    return this.once(`pair:${host}:${port}`, () => this.adb().pair(host, port, code));
  }

  async disconnect(serial: string): Promise<void> {
    this.lastInventory.delete(serial);
    await this.adb().disconnect(serial);
  }

  inventory(serial: string): Promise<DeviceInventory> {
    return this.once(`inventory:${serial}`, async () => {
      const driver = new AndroidFamilyDriver(this.adb().forDevice(serial));
      const inv = await driver.readInventory();
      this.lastInventory.set(serial, inv);
      return inv;
    });
  }

  /** Salva o que o usuário está vendo (último inventário); se não houver, lê agora. */
  snapshot(serial: string): Promise<{ dir: string; files: string[] }> {
    return this.once(`snapshot:${serial}`, async () => {
      const inv = this.lastInventory.get(serial) ?? (await this.inventory(serial));
      return writeSnapshot(inv, this.options.dataDir, { reason: 'manual' });
    });
  }

  /** Procura TVs na rede local (só leitura; nenhum comando ADB). */
  discover(): Promise<DiscoveryResult> {
    return this.once('discover', () => (this.options.discover ? this.options.discover() : discoverTvs()));
  }

  async snapshots(deviceId?: string): Promise<SnapshotSummary[]> {
    const all = await listSnapshots(this.options.dataDir);
    return deviceId ? all.filter((s) => s.deviceId === deviceId) : all;
  }

  private async currentInventory(serial: string): Promise<DeviceInventory> {
    return this.lastInventory.get(serial) ?? (await this.inventory(serial));
  }

  /** Lista de apps do sistema com a classificação de segurança, para a tela de limpeza. */
  async cleanup(serial: string): Promise<{ deviceId: string; items: CleanupItem[] }> {
    const inv = await this.currentInventory(serial);
    if (!inv.device.supported) throw new ServiceError(409, 'UNSUPPORTED', inv.device.supportReason);
    const ctx = deviceContext(inv);
    const mem = new Map(inv.processes.map((p) => [p.name, p.kb]));
    const items = inv.packages
      .filter((p) => p.system)
      .map((p) => {
        const c = classifyPackage(p.name, ctx, this.catalog);
        return {
          pkg: p.name, label: c.label, level: c.level, enabled: p.enabled, memoryKb: mem.get(p.name) ?? null,
          ...(c.description ? { description: c.description } : {}),
          ...(c.effect ? { effect: c.effect } : {}),
        };
      });
    return { deviceId: inv.deviceId, items };
  }

  private storePlan(plan: ChangePlan | null): void {
    const now = Date.now();
    for (const [id, p] of this.plans) if (now - Date.parse(p.createdAt) > PLAN_TTL_MS) this.plans.delete(id);
    if (plan) this.plans.set(plan.id, plan);
  }

  /** Só CALCULA o plano (nada é enviado à TV). */
  async plan(serial: string, request: { disable: string[]; enable: string[] }): Promise<{ plan: ChangePlan | null; rejected: Rejection[] }> {
    const inv = await this.currentInventory(serial);
    if (!inv.device.supported) throw new ServiceError(409, 'UNSUPPORTED', inv.device.supportReason);
    const result = buildPlan({ inventory: inv, serial, catalog: this.catalog, request });
    this.storePlan(result.plan);
    return result;
  }

  async restorePlan(serial: string, snapshotDir: string): Promise<{ plan: ChangePlan | null; rejected: Rejection[]; error?: string }> {
    const snap = await loadSnapshot(snapshotDir, this.options.dataDir);
    const current = await this.inventory(serial); // leitura fresca: restaurar exige estado atual exato
    const result = buildRestorePlan({ snapshot: snap.inventory, current, serial, catalog: this.catalog, snapshotDir, snapshotDate: snap.createdAt });
    this.storePlan(result.plan);
    return result;
  }

  /** Executa um plano calculado antes, se o hash for o mesmo que o usuário revisou. */
  execute(planId: string, hash: string): Promise<ExecutionResult> {
    return this.once(`execute:${planId}`, async () => {
      const writes = this.writesInfo();
      if (!writes.allowed) throw new ServiceError(403, 'REAL_WRITES_LOCKED', writes.reason ?? 'Bloqueado.');
      const plan = this.plans.get(planId);
      if (!plan) throw new ServiceError(404, 'PLAN_NOT_FOUND', 'Este plano expirou ou já foi usado. Monte o plano de novo.');
      if (plan.hash !== hash) throw new ServiceError(409, 'PLAN_CHANGED', 'O plano mudou depois de revisado. Revise de novo.');
      this.plans.delete(planId); // cada plano executa no máximo uma vez
      const result = await executePlan(plan, {
        adb: this.adb(), catalog: this.catalog, dataDir: this.options.dataDir, stepDelayMs: this.options.stepDelayMs ?? 0,
      });
      this.lastInventory.delete(plan.serial);
      return result;
    });
  }

  async pending(): Promise<PendingChange[]> {
    return (await this.journals.needingAttention()).map((j) => ({
      planId: j.planId, title: j.plan.title, deviceId: j.deviceId, status: j.status, startedAt: j.startedAt,
      ...(j.message ? { message: j.message } : {}),
    }));
  }

  /** Desfazer uma mudança pela metade. Sempre permitido: só desfaz o que o próprio Studio fez. */
  rollbackPending(planId: string, serial: string): Promise<ExecutionResult> {
    return this.once(`rollback:${planId}`, async () => {
      const r = await rollbackIncomplete(planId, serial, { adb: this.adb(), catalog: this.catalog, dataDir: this.options.dataDir });
      this.lastInventory.delete(serial);
      return r;
    });
  }
}

function isFile(f: string): boolean {
  try {
    return fs.statSync(f).isFile();
  } catch {
    return false;
  }
}

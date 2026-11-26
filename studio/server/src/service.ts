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
  discoverTvs,
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
}

export interface StudioStatus {
  mode: 'real' | 'fake';
  adb: { found: boolean; path: string | null; version: string | null };
  devices: AdbDeviceEntry[];
  dataDir: string;
  fakeNetwork?: readonly { host: string; scenario: string }[];
  /** updateAvailable: o código foi atualizado (ex.: git pull) depois que o Studio abriu. */
  version: { running: string; onDisk: string; updateAvailable: boolean };
}

export class StudioService {
  private readonly options: StudioServiceOptions;
  private adbPath: string | null = null;
  private executor: AdbExecutor | null = null;
  private version: string | null = null;
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly lastInventory = new Map<string, DeviceInventory>();
  private readonly getVersion: () => string;
  private readonly runningVersion: string;

  constructor(options: StudioServiceOptions) {
    this.options = options;
    this.getVersion = options.getVersion ?? (() => readCodeVersion(REPO_ROOT));
    this.runningVersion = this.getVersion();
    this.setup();
  }

  get mode(): 'real' | 'fake' {
    return this.options.transport ? 'fake' : 'real';
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
      ...(this.options.fakeNetwork ? { fakeNetwork: this.options.fakeNetwork } : {}),
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

  snapshots(): Promise<SnapshotSummary[]> {
    return listSnapshots(this.options.dataDir);
  }
}

function isFile(f: string): boolean {
  try {
    return fs.statSync(f).isFile();
  } catch {
    return false;
  }
}

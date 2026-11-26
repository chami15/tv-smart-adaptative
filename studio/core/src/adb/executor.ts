import { checkAllowlist } from './allowlist.ts';
import { checkWriteAllowlist, writeArgs } from './write-allowlist.ts';
import { isWriteGrant, type WriteGrant } from '../changes/grant.ts';
import { type AdbDeviceEntry, parseDevicesOutput } from './devices.ts';
import { AdbError, classifyAdbFailure } from './errors.ts';
import { AdbSpawnError, type AdbTransport } from './transport.ts';
import { isValidHost, isValidPairingCode, isValidPort, isValidSerial } from './validate.ts';

export type PackageListFlag = '-s' | '-3' | '-d' | '-e' | '-f' | '-U';

export interface ExecutorOptions {
  defaultTimeoutMs?: number;
  /** Observador de auditoria: recebe cada comando executado (útil para logs e testes). */
  onCommand?: (args: readonly string[]) => void;
}

/**
 * ÚNICA porta de entrada para falar com a TV.
 * Todo comando passa pela allowlist antes de chegar ao transporte.
 */
export class AdbExecutor {
  private readonly transport: AdbTransport;
  private readonly options: ExecutorOptions;

  constructor(transport: AdbTransport, options: ExecutorOptions = {}) {
    this.transport = transport;
    this.options = options;
  }

  /** Executa argumentos crus — ainda assim sujeitos à allowlist. */
  async exec(args: readonly string[], timeoutMs?: number): Promise<string> {
    const decision = checkAllowlist(args);
    if (!decision.allowed) throw new AdbError('COMMAND_REFUSED', `Comando recusado: ${decision.reason}`);
    this.options.onCommand?.(args);

    let result;
    try {
      result = await this.transport.run(args, { timeoutMs: timeoutMs ?? this.options.defaultTimeoutMs ?? 15_000 });
    } catch (err) {
      if (err instanceof AdbSpawnError) {
        if (err.kind === 'not-found') throw new AdbError('ADB_NOT_FOUND', err.message);
        if (err.kind === 'timeout') throw new AdbError('TIMEOUT', err.message);
      }
      throw new AdbError('UNKNOWN', err instanceof Error ? err.message : String(err));
    }

    const stdout = normalize(result.stdout);
    const stderr = normalize(result.stderr);
    if (result.exitCode !== 0) {
      const code = classifyAdbFailure(`${stderr}\n${stdout}`) ?? 'UNKNOWN';
      throw new AdbError(code, firstLine(stderr) || firstLine(stdout) || `adb saiu com código ${result.exitCode}`, stderr);
    }
    return stdout;
  }

  /**
   * Escrita na TV. Exige: comando na allowlist de escrita E autorização (WriteGrant) de um plano aprovado
   * que contenha exatamente este comando.
   */
  async execWrite(args: readonly string[], grant: WriteGrant): Promise<string> {
    if (!isWriteGrant(grant) || !grant.allows(args)) throw new AdbError('COMMAND_REFUSED', 'Escrita sem plano aprovado foi recusada.');
    const decision = checkWriteAllowlist(args);
    if (!decision.allowed) throw new AdbError('COMMAND_REFUSED', `Comando recusado: ${decision.reason}`);
    this.options.onCommand?.(args);
    let result;
    try {
      result = await this.transport.run(args, { timeoutMs: 20_000 });
    } catch (err) {
      if (err instanceof AdbSpawnError) throw new AdbError(err.kind === 'timeout' ? 'TIMEOUT' : err.kind === 'not-found' ? 'ADB_NOT_FOUND' : 'UNKNOWN', err.message);
      throw new AdbError('UNKNOWN', err instanceof Error ? err.message : String(err));
    }
    const stdout = normalize(result.stdout);
    const stderr = normalize(result.stderr);
    if (result.exitCode !== 0) {
      const code = classifyAdbFailure(`${stderr}\n${stdout}`) ?? 'UNKNOWN';
      throw new AdbError(code, firstLine(stderr) || firstLine(stdout) || `adb saiu com código ${result.exitCode}`, stderr);
    }
    return stdout;
  }

  async version(): Promise<string> {
    const out = await this.exec(['version']);
    return out.match(/version\s+([\d.]+)/i)?.[1] ?? firstLine(out);
  }

  async devices(): Promise<AdbDeviceEntry[]> {
    return parseDevicesOutput(await this.exec(['devices', '-l']));
  }

  /** `adb connect` pode sair com código 0 mesmo falhando: a saída é analisada. */
  async connect(host: string, port = 5555): Promise<{ serial: string; already: boolean }> {
    if (!isValidHost(host)) throw new AdbError('INVALID_ARGUMENT', 'Endereço IP inválido.');
    if (!isValidPort(port)) throw new AdbError('INVALID_ARGUMENT', 'Porta inválida.');
    const serial = `${host}:${port}`;
    const out = await this.exec(['connect', serial], 20_000);
    if (/already connected/i.test(out)) return { serial, already: true };
    if (/^connected to/im.test(out)) return { serial, already: false };
    const code = classifyAdbFailure(out) ?? 'CONNECTION_FAILED';
    throw new AdbError(code, firstLine(out) || 'Falha ao conectar', out);
  }

  async pair(host: string, port: number, code: string): Promise<void> {
    if (!isValidHost(host) || !isValidPort(port)) throw new AdbError('INVALID_ARGUMENT', 'Endereço de pareamento inválido.');
    if (!isValidPairingCode(code)) throw new AdbError('INVALID_ARGUMENT', 'O código de pareamento tem 6 dígitos.');
    const out = await this.exec(['pair', `${host}:${port}`, code], 30_000);
    if (!/successfully paired/i.test(out)) throw new AdbError('PAIRING_FAILED', firstLine(out) || 'Falha no pareamento', out);
  }

  async disconnect(serial?: string): Promise<void> {
    await this.exec(serial ? ['disconnect', serial] : ['disconnect']);
  }

  /** Comandos dentro da TV (todos de leitura nesta fase). */
  forDevice(serial: string): DeviceShell {
    if (!isValidSerial(serial)) throw new AdbError('INVALID_ARGUMENT', 'Identificador da TV inválido.');
    return new DeviceShell(this, serial);
  }
}

export class DeviceShell {
  readonly serial: string;
  private readonly executor: AdbExecutor;
  constructor(executor: AdbExecutor, serial: string) {
    this.executor = executor;
    this.serial = serial;
  }

  private run(args: string[], timeoutMs?: number): Promise<string> {
    return this.executor.exec(['-s', this.serial, ...args], timeoutMs);
  }

  async state(): Promise<string> {
    return (await this.run(['get-state'])).trim();
  }
  getprop(): Promise<string> {
    return this.run(['shell', 'getprop']);
  }
  listPackages(...flags: PackageListFlag[]): Promise<string> {
    return this.run(['shell', 'pm', 'list', 'packages', ...flags]);
  }
  listFeatures(): Promise<string> {
    return this.run(['shell', 'pm', 'list', 'features']);
  }
  procMeminfo(): Promise<string> {
    return this.run(['shell', 'cat', '/proc/meminfo']);
  }
  dumpsysMeminfo(): Promise<string> {
    return this.run(['shell', 'dumpsys', 'meminfo'], 45_000);
  }
  wmSize(): Promise<string> {
    return this.run(['shell', 'wm', 'size']);
  }
  wmDensity(): Promise<string> {
    return this.run(['shell', 'wm', 'density']);
  }
  /** Desativa/reativa um app. O pm pode "sair com sucesso" e ter falhado: a saída é conferida. */
  async setEnabled(pkg: string, enabled: boolean, grant: WriteGrant): Promise<void> {
    const out = await this.executor.execWrite(writeArgs(this.serial, enabled ? 'enable' : 'disable', pkg), grant);
    const expected = enabled ? /new state:\s*enabled/i : /new state:\s*disabled(-user)?/i;
    if (!expected.test(out)) {
      throw new AdbError('UNEXPECTED_OUTPUT', firstLine(out) || 'A TV não confirmou a mudança.', out);
    }
  }

  resolveHome(): Promise<string> {
    return this.run([
      'shell', 'cmd', 'package', 'resolve-activity', '--brief',
      '-a', 'android.intent.action.MAIN', '-c', 'android.intent.category.HOME',
    ]);
  }
}

function normalize(s: string): string {
  return s.replace(/\r\n?/g, '\n');
}
function firstLine(s: string): string {
  return s.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('*')) ?? '';
}

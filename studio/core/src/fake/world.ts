// FakeTvWorld: uma "rede doméstica" simulada com várias TVs.
// Implementa o mesmo AdbTransport do adb real, então todo o core é testado sem TV de verdade.
// Ele também registra cada comando recebido, para os testes provarem que nada de escrita foi enviado.
import { AdbSpawnError, type AdbRunOptions, type AdbRunResult, type AdbTransport } from '../adb/transport.ts';
import * as R from './render.ts';
import type { FakeBehavior, FakeDeviceSpec } from './types.ts';

interface Session {
  spec: FakeDeviceSpec;
  authorized: boolean;
  polls: number;
  shellCommands: number;
  offline: boolean;
}

export interface FakeWorldOptions {
  /** Atraso artificial (ms) para o modo de demonstração parecer real. 0 nos testes. */
  latencyMs?: number;
  pairingCode?: string;
}

export class FakeTvWorld implements AdbTransport {
  readonly calls: string[][] = [];
  private readonly hosts = new Map<string, FakeDeviceSpec>();
  private readonly sessions = new Map<string, Session>();
  private readonly paired = new Set<string>();
  private readonly latencyMs: number;
  private readonly pairingCode: string;

  constructor(options: FakeWorldOptions = {}) {
    this.latencyMs = options.latencyMs ?? 0;
    this.pairingCode = options.pairingCode ?? '123456';
  }

  /** Coloca uma TV na rede simulada. */
  addTv(host: string, spec: FakeDeviceSpec, behavior?: FakeBehavior): this {
    this.hosts.set(host, behavior ? { ...spec, behavior: { ...spec.behavior, ...behavior } } : spec);
    return this;
  }

  /** Simula o usuário apertando "Permitir" na TV. */
  acceptOnTv(serial: string): void {
    const s = this.sessions.get(serial);
    if (s) s.authorized = true;
  }

  /** Simula a rede caindo / TV desligando. */
  dropConnection(serial: string): void {
    const s = this.sessions.get(serial);
    if (s) s.offline = true;
  }

  async run(args: readonly string[], _options?: AdbRunOptions): Promise<AdbRunResult> {
    this.calls.push([...args]);
    if (this.latencyMs) await new Promise((r) => setTimeout(r, this.latencyMs));
    return this.handle(args);
  }

  private handle(args: readonly string[]): AdbRunResult {
    const ok = (stdout: string): AdbRunResult => ({ stdout, stderr: '', exitCode: 0 });
    const fail = (stderr: string, stdout = ''): AdbRunResult => ({ stdout, stderr, exitCode: 1 });

    const [cmd, ...rest] = args;
    switch (cmd) {
      case 'version':
        return ok('Android Debug Bridge version 1.0.41\nVersion 36.0.0-simulado\nInstalled as (simulado)\n');
      case 'devices': {
        const lines = ['List of devices attached'];
        for (const [serial, s] of this.sessions) {
          this.tickAuth(s);
          const state = s.offline ? 'offline' : s.authorized ? 'device' : 'unauthorized';
          const extra = s.authorized && !s.offline ? ` product:${s.spec.props['ro.product.name']} model:${(s.spec.props['ro.product.model'] ?? '').replace(/ /g, '_')} device:${s.spec.props['ro.product.device']}` : '';
          lines.push(`${serial}\t${state}${extra} transport_id:1`);
        }
        return ok(lines.join('\n') + '\n\n');
      }
      case 'connect': {
        const serial = rest[0] ?? '';
        const host = serial.split(':')[0] ?? '';
        const spec = this.hosts.get(host);
        if (!spec) return fail('', `cannot connect to ${serial}: No route to host (113)\n`);
        const b = spec.behavior ?? {};
        if (b.timeout) throw new AdbSpawnError('timeout', 'tempo esgotado (simulado)');
        if (b.refuseConnection) return fail('', `failed to connect to '${serial}': Connection refused\n`);
        const existing = this.sessions.get(serial);
        if (existing && !existing.offline) return ok(`already connected to ${serial}\n`);
        this.sessions.set(serial, {
          spec,
          authorized: this.paired.has(host) || (b.auth ?? 'accept') === 'accept' && (b.acceptAfterPolls ?? 0) === 0,
          polls: 0,
          shellCommands: 0,
          offline: false,
        });
        return ok(`connected to ${serial}\n`);
      }
      case 'disconnect': {
        if (rest[0]) {
          if (!this.sessions.delete(rest[0])) return fail(`error: no such device '${rest[0]}'\n`);
        } else this.sessions.clear();
        return ok(rest[0] ? `disconnected ${rest[0]}\n` : 'disconnected everything\n');
      }
      case 'pair': {
        const host = (rest[0] ?? '').split(':')[0] ?? '';
        if (!this.hosts.has(host)) return fail('', `Failed: Unable to start pairing client.\n`);
        if (rest[1] !== this.pairingCode) return fail('', 'Failed: Wrong password or connection was dropped.\n');
        this.paired.add(host);
        return ok(`Successfully paired to ${rest[0]} [guid=adb-SIMULADO-abc123]\n`);
      }
      case '-s':
        return this.handleDevice(rest[0] ?? '', rest.slice(1));
      default:
        return fail(`adb: unknown command ${cmd}\n`);
    }
  }

  private tickAuth(s: Session): void {
    if (s.authorized) return;
    const b = s.spec.behavior ?? {};
    if ((b.auth ?? 'accept') !== 'accept') return;
    s.polls++;
    if (s.polls >= (b.acceptAfterPolls ?? 0)) s.authorized = true;
  }

  private handleDevice(serial: string, args: readonly string[]): AdbRunResult {
    const ok = (stdout: string): AdbRunResult => ({ stdout, stderr: '', exitCode: 0 });
    const fail = (stderr: string): AdbRunResult => ({ stdout: '', stderr, exitCode: 1 });
    const s = this.sessions.get(serial);
    if (!s) return fail(`error: device '${serial}' not found\n`);
    if (s.offline) return fail('error: device offline\n');
    if (!s.authorized) {
      this.tickAuth(s);
      if (!s.authorized) return fail("error: device unauthorized.\nThis adb server's $ADB_VENDOR_KEYS is not set\n");
    }
    if (args[0] === 'get-state') return ok('device\n');
    if (args[0] !== 'shell') return fail(`adb: unknown command ${args[0]}\n`);

    const b = s.spec.behavior ?? {};
    s.shellCommands++;
    if (b.dropAfterCommands !== undefined && s.shellCommands > b.dropAfterCommands) {
      s.offline = true;
      return fail('error: device offline\n');
    }
    const sh = args.slice(1);
    const key = sh.join(' ');
    let out: string;
    if (sh[0] === 'getprop' && sh.length === 1) out = R.renderGetprop(s.spec);
    else if (sh[0] === 'getprop') out = (s.spec.props[sh[1] ?? ''] ?? '') + '\n';
    else if (key.startsWith('pm list packages')) out = R.renderPackages(s.spec, sh.slice(3));
    else if (key === 'pm list features') out = R.renderFeatures(s.spec);
    else if (key === 'cat /proc/meminfo') out = R.renderProcMeminfo(s.spec);
    else if (key === 'dumpsys meminfo') out = R.renderDumpsysMeminfo(s.spec);
    else if (key === 'wm size') out = R.renderWmSize(s.spec);
    else if (key === 'wm density') out = R.renderWmDensity(s.spec);
    else if (key.startsWith('cmd package resolve-activity')) out = R.renderResolveHome(s.spec);
    else return ok(`/system/bin/sh: ${sh[0]}: inaccessible or not found\n`);

    if (b.garbage) out = garble(out);
    return ok(out);
  }
}

function garble(text: string): string {
  // corta no meio e mistura lixo, como uma conexão instável faria
  const half = text.slice(0, Math.max(1, Math.floor(text.length / 3)));
  return half.replace(/\]/g, '').replace(/:/g, '') + '\n\u0000\u001b[31m???\n%%%%\n';
}

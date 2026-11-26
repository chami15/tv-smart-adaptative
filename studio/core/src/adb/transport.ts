import { execFile } from 'node:child_process';

export interface AdbRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface AdbRunOptions {
  timeoutMs?: number;
}

/** Quem realmente executa o adb. Em testes é substituído pelo FakeTvDevice. */
export interface AdbTransport {
  run(args: readonly string[], options?: AdbRunOptions): Promise<AdbRunResult>;
}

export class AdbSpawnError extends Error {
  readonly kind: 'not-found' | 'timeout' | 'other';
  constructor(kind: 'not-found' | 'timeout' | 'other', message: string) {
    super(message);
    this.kind = kind;
  }
}

/** Executa o adb.exe de verdade, SEM shell (execFile + lista de argumentos). */
export class RealAdbTransport implements AdbTransport {
  readonly adbPath: string;
  constructor(adbPath: string) {
    this.adbPath = adbPath;
  }

  run(args: readonly string[], options: AdbRunOptions = {}): Promise<AdbRunResult> {
    const timeout = options.timeoutMs ?? 15_000;
    return new Promise((resolve, reject) => {
      execFile(
        this.adbPath,
        [...args],
        { timeout, maxBuffer: 32 * 1024 * 1024, windowsHide: true, encoding: 'utf8', shell: false },
        (error, stdout, stderr) => {
          if (error) {
            const e = error as NodeJS.ErrnoException & { killed?: boolean; code?: unknown };
            if (e.code === 'ENOENT') return reject(new AdbSpawnError('not-found', `adb não encontrado em ${this.adbPath}`));
            if (e.killed) return reject(new AdbSpawnError('timeout', `adb excedeu ${timeout} ms`));
            if (typeof e.code === 'number') return resolve({ stdout, stderr, exitCode: e.code });
            return reject(new AdbSpawnError('other', e.message));
          }
          resolve({ stdout, stderr, exitCode: 0 });
        },
      );
    });
  }
}

import { describe, expect, it } from 'vitest';
import { AdbError, AdbExecutor, AdbSpawnError, type AdbTransport } from '../../src/adb/index.ts';

function stub(respond: (args: readonly string[]) => { stdout?: string; stderr?: string; exitCode?: number } | Error) {
  const calls: (readonly string[])[] = [];
  const transport: AdbTransport = {
    async run(args) {
      calls.push(args);
      const r = respond(args);
      if (r instanceof Error) throw r;
      return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', exitCode: r.exitCode ?? 0 };
    },
  };
  return { transport, calls };
}

describe('AdbExecutor', () => {
  it('comando recusado nunca chega ao transporte', async () => {
    const { transport, calls } = stub(() => ({}));
    const ex = new AdbExecutor(transport);
    await expect(ex.exec(['-s', '1.2.3.4:5555', 'shell', 'pm', 'uninstall', 'com.tcl.tv'])).rejects.toMatchObject({
      code: 'COMMAND_REFUSED',
    });
    expect(calls).toHaveLength(0);
  });

  it('connect: sucesso e "already connected"', async () => {
    const { transport } = stub((a) => ({ stdout: a[1] === '10.0.0.2:5555' ? 'connected to 10.0.0.2:5555\r\n' : 'already connected to 10.0.0.3:5555' }));
    const ex = new AdbExecutor(transport);
    expect(await ex.connect('10.0.0.2')).toEqual({ serial: '10.0.0.2:5555', already: false });
    expect(await ex.connect('10.0.0.3')).toEqual({ serial: '10.0.0.3:5555', already: true });
  });

  it.each([
    ["failed to connect to '10.0.0.9:5555': Connection refused", 'CONNECTION_REFUSED'],
    ['cannot connect to 10.0.0.9:5555: No route to host (113)', 'HOST_UNREACHABLE'],
    ['cannot connect to 10.0.0.9:5555: Connection timed out (110)', 'TIMEOUT'],
    ['failed to authenticate to 10.0.0.9:5555', 'DEVICE_UNAUTHORIZED'],
    ['algo estranho', 'CONNECTION_FAILED'],
  ])('connect: falha com saída 0 "%s" → %s', async (stdout, code) => {
    const ex = new AdbExecutor(stub(() => ({ stdout })).transport);
    await expect(ex.connect('10.0.0.9')).rejects.toMatchObject({ code });
  });

  it('connect: IP inválido não executa nada', async () => {
    const { transport, calls } = stub(() => ({}));
    await expect(new AdbExecutor(transport).connect('10.0.0')).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    expect(calls).toHaveLength(0);
  });

  it.each([
    ['error: device unauthorized.\nThis adb server\'s $ADB_VENDOR_KEYS is not set', 'DEVICE_UNAUTHORIZED'],
    ['error: device offline', 'DEVICE_OFFLINE'],
    ["error: device '10.0.0.2:5555' not found", 'DEVICE_NOT_FOUND'],
  ])('erros de dispositivo: %s → %s', async (stderr, code) => {
    const ex = new AdbExecutor(stub(() => ({ stderr, exitCode: 1 })).transport);
    await expect(ex.forDevice('10.0.0.2:5555').getprop()).rejects.toMatchObject({ code });
  });

  it('adb ausente e timeout viram erros tipados', async () => {
    const nf = new AdbExecutor(stub(() => new AdbSpawnError('not-found', 'x')).transport);
    await expect(nf.version()).rejects.toMatchObject({ code: 'ADB_NOT_FOUND' });
    const to = new AdbExecutor(stub(() => new AdbSpawnError('timeout', 'x')).transport);
    await expect(to.version()).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('normaliza CRLF', async () => {
    const ex = new AdbExecutor(stub(() => ({ stdout: '[a]: [b]\r\n' })).transport);
    expect(await ex.forDevice('10.0.0.2:5555').getprop()).toBe('[a]: [b]\n');
  });

  it('pair: código precisa ter 6 dígitos; sucesso reconhecido', async () => {
    const ex = new AdbExecutor(stub(() => ({ stdout: 'Successfully paired to 10.0.0.2:37000 [guid=adb-x]' })).transport);
    await expect(ex.pair('10.0.0.2', 37000, '12a456')).rejects.toBeInstanceOf(AdbError);
    await expect(ex.pair('10.0.0.2', 37000, '123456')).resolves.toBeUndefined();
  });

  it('auditoria: onCommand recebe cada comando permitido', async () => {
    const seen: string[] = [];
    const ex = new AdbExecutor(stub(() => ({ stdout: 'Android Debug Bridge version 1.0.41' })).transport, {
      onCommand: (a) => seen.push(a.join(' ')),
    });
    expect(await ex.version()).toBe('1.0.41');
    expect(seen).toEqual(['version']);
  });
});

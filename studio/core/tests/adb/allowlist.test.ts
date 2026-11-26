import { describe, expect, it } from 'vitest';
import { checkAllowlist } from '../../src/adb/allowlist.ts';

const S = ['-s', '192.168.0.50:5555'];

describe('allowlist (Fase 1: somente leitura)', () => {
  it.each([
    [['version']],
    [['devices', '-l']],
    [['connect', '192.168.0.50:5555']],
    [['disconnect']],
    [['disconnect', '192.168.0.50:5555']],
    [['pair', '192.168.0.50:37123', '123456']],
    [[...S, 'get-state']],
    [[...S, 'shell', 'getprop']],
    [[...S, 'shell', 'getprop', 'ro.product.brand']],
    [[...S, 'shell', 'pm', 'list', 'packages']],
    [[...S, 'shell', 'pm', 'list', 'packages', '-s', '-d']],
    [[...S, 'shell', 'pm', 'list', 'features']],
    [[...S, 'shell', 'cat', '/proc/meminfo']],
    [[...S, 'shell', 'dumpsys', 'meminfo']],
    [[...S, 'shell', 'wm', 'size']],
    [[...S, 'shell', 'wm', 'density']],
    [[...S, 'shell', 'cmd', 'package', 'resolve-activity', '--brief', '-a', 'android.intent.action.MAIN', '-c', 'android.intent.category.HOME']],
  ])('permite %j', (args) => {
    expect(checkAllowlist(args).allowed).toBe(true);
  });

  it.each([
    // escrita — proibida nesta fase
    [[...S, 'shell', 'pm', 'disable-user', '--user', '0', 'com.tcl.waterfall.overseas']],
    [[...S, 'shell', 'pm', 'enable', 'com.tcl.waterfall.overseas']],
    [[...S, 'shell', 'pm', 'uninstall', 'com.tcl.tv']],
    [[...S, 'install', 'app.apk']],
    [[...S, 'push', 'a', '/sdcard/a']],
    [[...S, 'shell', 'settings', 'put', 'global', 'x', '1']],
    [[...S, 'reboot']],
    [[...S, 'reboot', 'bootloader']],
    [['root']],
    [['shell', 'getprop']], // sem serial
    [[...S, 'shell']], // shell interativo
    [[...S, 'shell', 'cat', '/data/system/packages.xml']],
    [[...S, 'shell', 'pm', 'list', 'packages', '-s', '-s']], // flag repetida
    [[...S, 'shell', 'pm', 'list', 'packages', '--user', '0']],
    // injeção de shell (adb shell junta os argumentos!)
    [[...S, 'shell', 'getprop', 'ro.x;rm -rf /']],
    [[...S, 'shell', 'getprop', 'ro.x', '&&', 'reboot']],
    [[...S, 'shell', 'getprop', '$(reboot)']],
    [[...S, 'shell', 'getprop', 'ro.x|sh']],
    [[...S, 'shell', 'getprop', "ro.x'"]],
    [['connect', '192.168.0.50:5555;reboot']],
    [['connect', '999.1.1.1:5555']],
    [['connect', '192.168.0.50']],
    [['pair', '192.168.0.50:37123', '12345']],
    [['-s', 'bad serial', 'get-state']],
    [[]],
  ])('recusa %j', (args) => {
    expect(checkAllowlist(args).allowed).toBe(false);
  });
});

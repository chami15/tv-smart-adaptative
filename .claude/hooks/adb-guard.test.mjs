import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkCommand, splitSegments } from './adb-guard.mjs';

const HOOK = fileURLToPath(new URL('./adb-guard.mjs', import.meta.url));

const allowed = [
  'ls -la',
  'rm -rf node_modules', // sem adb: não é problema do hook
  'git commit -m "remove adb wrapper"',
  'adb devices',
  'adb connect 192.168.0.20:5555',
  'adb -s 192.168.0.20:5555 shell getprop ro.product.model',
  'adb shell pm list packages -s',
  'adb shell dumpsys meminfo',
  'adb shell pm disable-user --user 0 com.tcl.waterfall.overseas',
  'adb shell pm enable com.tcl.waterfall.overseas',
  'adb install -r launcher/app-release.apk',
  'adb uninstall com.tvsmartadaptative.launcher',
  'adb shell pm list packages > backups/packages.txt && echo ok',
];

const blocked = [
  'fastboot flash boot boot.img',
  'adb reboot bootloader',
  'adb reboot recovery',
  'adb root',
  'adb remount',
  'adb shell su -c id',
  'adb shell rm -rf /sdcard',
  'adb shell "ls; rm -rf /data/local/tmp/x"',
  'adb shell dd if=/dev/zero of=/dev/block/mmcblk0',
  'adb shell pm uninstall -k --user 0 com.tcl.tv',
  'adb shell cmd package uninstall com.android.vending',
  'adb uninstall com.tcl.tv',
  'adb shell pm clear com.google.android.gms',
  'adb shell settings put global http_proxy 1.2.3.4:8080',
  'adb shell setprop persist.sys.foo 1',
  'adb shell svc wifi disable',
  'adb shell pm disable-user --user 0 com.tcl.tvinput',
  'adb shell pm disable-user --user 0 com.google.android.gms',
  'adb shell pm disable-user com.android.systemui',
  'adb shell pm hide com.tcl.waterfall.overseas',
  'adb shell',
  'adb -s 192.168.0.20:5555 shell < script.sh',
  'echo ok && adb shell rm /sdcard/x',
  'adb.exe shell rm /sdcard/x',
  // Windows
  'C:\\platform-tools\\adb.exe shell rm /sdcard/x',
  '& "C:\\Program Files\\platform-tools\\adb.exe" reboot bootloader',
  'C:\\platform-tools\\fastboot.exe devices',
  'cmd /c adb shell pm uninstall --user 0 com.android.tv.settings',
];

const allowedWindows = [
  'C:\\platform-tools\\adb.exe devices -l',
  '& "C:\\Program Files\\platform-tools\\adb.exe" shell getprop ro.product.brand',
  'npm run dev; adb devices',
];
for (const cmd of allowedWindows) {
  test(`permite (Windows): ${cmd}`, () => assert.equal(checkCommand(cmd).blocked, false));
}

for (const cmd of allowed) {
  test(`permite: ${cmd}`, () => assert.equal(checkCommand(cmd).blocked, false));
}
for (const cmd of blocked) {
  test(`bloqueia: ${cmd}`, () => assert.equal(checkCommand(cmd).blocked, true));
}

test('splitSegments respeita aspas', () => {
  assert.deepEqual(splitSegments('a; b "c; d" && e'), ['a', 'b "c; d"', 'e']);
});

test('hook via stdin: sai com 2 e explica o motivo ao bloquear', () => {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'adb reboot bootloader' } }),
  });
  assert.equal(r.status, 2);
  assert.match(r.stderr.toString(), /Bloqueado pelo adb-guard/);
});

test('hook via stdin: sai com 0 para comando seguro ou entrada inválida', () => {
  const ok = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_input: { command: 'adb devices' } }),
  });
  assert.equal(ok.status, 0);
  const bad = spawnSync(process.execPath, [HOOK], { input: 'não é json' });
  assert.equal(bad.status, 0);
});

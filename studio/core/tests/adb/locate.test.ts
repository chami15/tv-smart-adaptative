import { expect, it } from 'vitest';
import { locateAdb } from '../../src/adb/locate.ts';

const winEnv = {
  PATH: 'C:\\Windows\\System32;"C:\\Program Files\\Git\\cmd"',
  LOCALAPPDATA: 'C:\\Users\\Ana\\AppData\\Local',
  USERPROFILE: 'C:\\Users\\Ana',
};

it('Windows: encontra o adb do Android SDK', () => {
  const target = 'C:\\Users\\Ana\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
  expect(locateAdb({ platform: 'win32', env: winEnv, exists: (f) => f === target })).toBe(target);
});

it('Windows: encontra em Downloads\\platform-tools', () => {
  const target = 'C:\\Users\\Ana\\Downloads\\platform-tools\\adb.exe';
  expect(locateAdb({ platform: 'win32', env: winEnv, exists: (f) => f === target })).toBe(target);
});

it('Windows: aceita TVSA_ADB_PATH apontando para a pasta', () => {
  const target = 'D:\\ferramentas\\platform-tools\\adb.exe';
  const env = { ...winEnv, TVSA_ADB_PATH: 'D:\\ferramentas\\platform-tools' };
  expect(locateAdb({ platform: 'win32', env, exists: (f) => f === target })).toBe(target);
});

it('Windows: PATH com aspas', () => {
  const env = { ...winEnv, PATH: '"C:\\pt"' };
  expect(locateAdb({ platform: 'win32', env, exists: (f) => f === 'C:\\pt\\adb.exe' })).toBe('C:\\pt\\adb.exe');
});

it('retorna null quando não existe', () => {
  expect(locateAdb({ platform: 'win32', env: winEnv, exists: () => false })).toBeNull();
});

it('Linux: encontra no PATH', () => {
  expect(locateAdb({ platform: 'linux', env: { PATH: '/usr/bin' }, exists: (f) => f === '/usr/bin/adb' })).toBe('/usr/bin/adb');
});

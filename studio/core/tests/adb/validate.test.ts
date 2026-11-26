import { describe, expect, it } from 'vitest';
import { isValidHost, isValidHostPort, isValidPackageName, isValidPort, isValidSerial } from '../../src/adb/validate.ts';

describe('validação', () => {
  it('host', () => {
    expect(isValidHost('192.168.0.50')).toBe(true);
    expect(isValidHost('minha-tv.local')).toBe(true);
    expect(isValidHost('256.1.1.1')).toBe(false);
    expect(isValidHost('192.168.0')).toBe(false);
    expect(isValidHost('a b')).toBe(false);
    expect(isValidHost('')).toBe(false);
  });
  it('porta', () => {
    expect(isValidPort(5555)).toBe(true);
    expect(isValidPort('5555')).toBe(true);
    expect(isValidPort(0)).toBe(false);
    expect(isValidPort(70000)).toBe(false);
    expect(isValidPort('55a')).toBe(false);
    expect(isValidPort('')).toBe(false);
  });
  it('host:porta', () => {
    expect(isValidHostPort('10.0.0.2:5555')).toBe(true);
    expect(isValidHostPort('10.0.0.2')).toBe(false);
  });
  it('pacote', () => {
    expect(isValidPackageName('com.tcl.tv')).toBe(true);
    expect(isValidPackageName('com.google.android.apps.tv.launcherx')).toBe(true);
    expect(isValidPackageName('android')).toBe(false); // um segmento: tratado à parte quando necessário
    expect(isValidPackageName('com.x;rm')).toBe(false);
  });
  it('serial', () => {
    expect(isValidSerial('192.168.0.50:5555')).toBe(true);
    expect(isValidSerial('ABC123XYZ')).toBe(true);
    expect(isValidSerial('adb-ABC123-xYz._adb-tls-connect._tcp')).toBe(true);
    expect(isValidSerial('x; reboot')).toBe(false);
  });
});

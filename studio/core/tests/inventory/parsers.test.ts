import { describe, expect, it } from 'vitest';
import * as P from '../../src/inventory/parsers.ts';
import { classifyRam, classifyResolution } from '../../src/inventory/classes.ts';

describe('parsers', () => {
  it('getprop: CRLF, valores vazios e multilinha', () => {
    const out = '[ro.product.brand]: [TCL]\r\n[ro.empty]: []\r\n[ro.multi]: [linha1\r\nlinha2]\r\nlixo\r\n[sem.fim]: [abc';
    expect(P.parseGetprop(out)).toEqual({ 'ro.product.brand': 'TCL', 'ro.empty': '', 'ro.multi': 'linha1\nlinha2' });
  });

  it('pm list packages: formatos simples, -f e -U; ignora lixo', () => {
    const out = 'package:com.a.b\npackage:/system/app/X/X.apk=com.tcl.tv\npackage:com.c.d uid:10023\npackage:android\nWARNING: x\npackage:com.bad;rm\n';
    expect(P.parsePackageList(out)).toEqual(['com.a.b', 'com.tcl.tv', 'com.c.d', 'android']);
  });

  it('features', () => {
    expect(P.parseFeatures('feature:android.software.leanback\nfeature:reqGlEsVersion=0x30002\nxx')).toEqual([
      'android.software.leanback',
      'reqGlEsVersion',
    ]);
  });

  it('meminfo: com e sem MemAvailable (Androids antigos)', () => {
    expect(P.parseProcMeminfo('MemTotal: 2000 kB\nMemAvailable: 500 kB\n')).toEqual({ totalKb: 2000, availableKb: 500 });
    expect(P.parseProcMeminfo('MemTotal: 2000 kB\nMemFree: 100 kB\nCached: 300 kB\n')).toEqual({ totalKb: 2000, availableKb: 400 });
    expect(P.parseProcMeminfo('nada')).toEqual({ totalKb: null, availableKb: null });
  });

  it('dumpsys meminfo: PSS e RSS, ordenado', () => {
    const pss = 'x\nTotal PSS by process:\n    61,000K: com.tcl.a (pid 1 / activities)\n   192,000K: com.google.x (pid 2)\n\nTotal PSS by OOM adjustment:\n  1K: y (pid 3)';
    expect(P.parseDumpsysMeminfo(pss)).toEqual([
      { name: 'com.google.x', kb: 192000 },
      { name: 'com.tcl.a', kb: 61000 },
    ]);
    expect(P.parseDumpsysMeminfo('Total RSS by process:\n  10,000K: system (pid 9)\n')).toEqual([{ name: 'system', kb: 10000 }]);
    expect(P.parseDumpsysMeminfo('corrompido')).toEqual([]);
  });

  it('wm size/density: override tem prioridade', () => {
    expect(P.parseWmSize('Physical size: 3840x2160\nOverride size: 1920x1080')).toEqual({ width: 1920, height: 1080 });
    expect(P.parseWmSize('Physical size: 1280x720')).toEqual({ width: 1280, height: 720 });
    expect(P.parseWmDensity('Physical density: 320')).toBe(320);
    expect(P.parseWmSize('')).toBeNull();
  });

  it('home atual: expande nome curto e trata "No activity found"', () => {
    expect(P.parseResolveHome('priority=0 isDefault=true\ncom.google.android.tvlauncher/.MainActivity\n')).toEqual({
      package: 'com.google.android.tvlauncher',
      activity: 'com.google.android.tvlauncher.MainActivity',
    });
    expect(P.parseResolveHome('No activity found')).toBeNull();
  });

  it('classes de RAM e resolução', () => {
    expect(classifyRam(1900 * 1024)).toBe('low');
    expect(classifyRam(2900 * 1024)).toBe('medium');
    expect(classifyRam(8 * 1024 * 1024)).toBe('high');
    expect(classifyRam(null)).toBe('unknown');
    expect(classifyResolution({ width: 3840, height: 2160 })).toBe('4k');
    expect(classifyResolution({ width: 1920, height: 1080 })).toBe('1080p');
    expect(classifyResolution({ width: 1080, height: 2400 })).toBe('1080p');
    expect(classifyResolution({ width: 1280, height: 720 })).toBe('720p');
  });
});

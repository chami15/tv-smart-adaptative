import { describe, expect, it } from 'vitest';
import { classifyPackage, loadCatalog } from '../../src/catalog/index.ts';
import { loadFakeDevices } from '../../src/fake/index.ts';

const catalog = loadCatalog();
const tcl = { brand: 'TCL', manufacturer: 'TCL', model: 'Smart TV Pro', currentHome: 'com.google.android.apps.tv.launcherx' };
const philips = { brand: 'Philips', manufacturer: 'TPVision', model: '43PFG6825', currentHome: 'com.google.android.tvlauncher' };

describe('catálogo por camadas', () => {
  it('núcleo fixo é sempre 🔴, mesmo que um catálogo diga outra coisa', () => {
    const evil = { layers: [{ name: 'x', packages: { 'com.google.android.gms': { level: 'safe' as const, label: 'x' } } }] };
    expect(classifyPackage('com.google.android.gms', tcl, evil).level).toBe('protected');
    expect(classifyPackage('com.android.providers.media', tcl, catalog).level).toBe('protected');
  });

  it('tela inicial em uso é 🔴 (troca só na Fase 4), qualquer que seja a marca', () => {
    expect(classifyPackage('com.droidlogic.mboxlauncher', { ...tcl, currentHome: 'com.droidlogic.mboxlauncher' }, catalog).level).toBe('protected');
  });

  it('camada da marca só vale para a marca certa', () => {
    expect(classifyPackage('com.tcl.guard', tcl, catalog).level).toBe('safe');
    expect(classifyPackage('com.tcl.guard', philips, catalog).source).toBe('desconhecido');
    expect(classifyPackage('org.droidtv.playtv', philips, catalog).level).toBe('protected');
  });

  it('entradas da TCL são 🔴 (inclusive o painel rápido de entradas)', () => {
    for (const p of ['com.tcl.tv', 'com.tcl.tvinput', 'com.tcl.suspension']) expect(classifyPackage(p, tcl, catalog).level).toBe('protected');
  });

  it('🔴 de qualquer camada vence o 🟡 de outra; prefixo mais longo vence', () => {
    const amlogic = { brand: 'Android', manufacturer: 'Amlogic', model: 'X', currentHome: null };
    expect(classifyPackage('com.droidlogic.tvinput', amlogic, catalog).level).toBe('protected');
    expect(classifyPackage('com.droidlogic.appinstall', amlogic, catalog).level).toBe('caution');
  });

  it('desconhecido nunca é 🟢; nome com cara de essencial vira 🔴', () => {
    const unk = { brand: 'Marca', manufacturer: 'Marca', model: 'M', currentHome: null };
    expect(classifyPackage('com.marca.qualquercoisa', unk, catalog)).toMatchObject({ level: 'caution', source: 'desconhecido' });
    expect(classifyPackage('com.marca.hdmicec', unk, catalog).level).toBe('protected');
    expect(classifyPackage('com.marca.tvinputservice', unk, catalog).level).toBe('protected');
    expect(classifyPackage('com.marca.otaupdate', unk, catalog).level).toBe('caution');
  });

  it('em nenhuma TV simulada um app de entrada/controle/rede/configuração sai 🟢', () => {
    for (const spec of loadFakeDevices().values()) {
      const ctx = { brand: spec.props['ro.product.brand']!, manufacturer: spec.props['ro.product.manufacturer']!, model: spec.props['ro.product.model']!, currentHome: spec.home?.split('/')[0] ?? null };
      for (const p of spec.packages) {
        const c = classifyPackage(p.name, ctx, catalog);
        if (/input|remote|bluetooth|settings|provider|wifi|network|gms|gsf|systemui/.test(p.name)) expect(c.level, p.name).toBe('protected');
      }
    }
  });

  it('todas as entradas do catálogo têm nível válido e rótulo', () => {
    for (const layer of catalog.layers)
      for (const [k, e] of Object.entries(layer.packages)) {
        expect(['protected', 'caution', 'safe'], `${layer.name}:${k}`).toContain(e.level);
        expect(e.label.length, `${layer.name}:${k}`).toBeGreaterThan(2);
      }
  });
});

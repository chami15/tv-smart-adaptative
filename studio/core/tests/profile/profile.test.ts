import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultProfile, parseProfile, validateProfile } from '../../src/profile/index.ts';
import { connected } from '../changes/helpers.ts';

const EX = path.resolve(import.meta.dirname, '../../../../shared/profile/examples');
const files = (kind: string) => fs.readdirSync(path.join(EX, kind)).map((f) => [f, fs.readFileSync(path.join(EX, kind, f), 'utf8')] as const);

describe('perfil v1 — exemplos compartilhados com o Launcher (Kotlin)', () => {
  it.each(files('valid'))('válido: %s', (_f, text) => {
    expect(parseProfile(text)).toMatchObject({ ok: true });
  });
  it.each(files('invalid'))('inválido: %s', (_f, text) => {
    const r = parseProfile(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThan(0);
  });

  it('campos desconhecidos são descartados na cópia limpa', () => {
    const r = parseProfile(fs.readFileSync(path.join(EX, 'valid', 'campo-futuro.json'), 'utf8'));
    expect(r.ok && JSON.stringify(r.profile)).not.toContain('widgetsDoFuturo');
  });
});

describe('perfil padrão adaptado à TV', () => {
  it('TCL: favoritos com apps de vídeo e apps do usuário, entradas (tem TV ao vivo), todos os apps', async () => {
    const { inv } = await connected('192.168.0.50');
    const p = defaultProfile(inv);
    expect(validateProfile(p).ok).toBe(true);
    expect(p.name).toBe('TCL Smart TV Pro');
    expect(p.rows.map((r) => r.type)).toEqual(['apps', 'inputs', 'all-apps']);
    expect(p.rows[0]!.apps).toEqual(expect.arrayContaining(['com.netflix.ninja', 'com.globo.globotv', 'br.com.spotify.tv']));
  });

  it('Mi Box (sem sintonizador): sem fileira de entradas', async () => {
    const { inv } = await connected('192.168.0.52');
    expect(defaultProfile(inv).rows.map((r) => r.type)).toEqual(['apps', 'all-apps']);
  });

  it('app desativado não entra nos favoritos', async () => {
    const { inv } = await connected('192.168.0.50');
    const disabledNetflix = { ...inv, packages: inv.packages.map((p) => (p.name === 'com.netflix.ninja' ? { ...p, enabled: false } : p)) };
    expect(defaultProfile(disabledNetflix).rows[0]!.apps).not.toContain('com.netflix.ninja');
  });
});

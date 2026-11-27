// Perfil da TV (v1). As MESMAS regras são implementadas no Launcher (Kotlin) e verificadas
// pelos exemplos em shared/profile/examples — se um lado mudar, os testes do outro avisam.
import fs from 'node:fs';
import type { DeviceInventory } from '../inventory/collect.ts';

export const PROFILE_SCHEMA_VERSION = 1;
export type RowType = 'apps' | 'inputs' | 'all-apps';

export interface ProfileRow {
  id: string;
  title: string;
  type: RowType;
  apps?: string[];
}

export interface Profile {
  schemaVersion: 1;
  name: string;
  theme?: { background?: string; accent?: string; text?: string };
  clock?: { show?: boolean; format24h?: boolean };
  iconSize?: 'auto' | 'small' | 'medium' | 'large';
  lightMode?: 'auto' | 'on' | 'off';
  rows: ProfileRow[];
}

export type ProfileResult = { ok: true; profile: Profile } | { ok: false; errors: string[] };

const COLOR = /^#[0-9A-Fa-f]{6}$/;
const ROW_ID = /^[a-z0-9-]{1,32}$/;
const PACKAGE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
const ROW_TYPES = new Set(['apps', 'inputs', 'all-apps']);
const ICON_SIZES = new Set(['auto', 'small', 'medium', 'large']);
const LIGHT = new Set(['auto', 'on', 'off']);

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown, min: number, max: number): v is string => typeof v === 'string' && v.length >= min && v.length <= max;

export function parseProfile(text: string): ProfileResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['O arquivo do perfil não é um JSON válido.'] };
  }
  return validateProfile(value);
}

/** Valida e devolve uma cópia LIMPA (só campos conhecidos). Campos desconhecidos são ignorados. */
export function validateProfile(value: unknown): ProfileResult {
  const errors: string[] = [];
  if (!isObj(value)) return { ok: false, errors: ['O perfil precisa ser um objeto JSON.'] };
  if (value.schemaVersion !== PROFILE_SCHEMA_VERSION) errors.push(`Versão de perfil não suportada: ${String(value.schemaVersion)} (esperado 1).`);
  if (!isStr(value.name, 1, 60)) errors.push('O nome do perfil deve ter de 1 a 60 caracteres.');

  const out: Profile = { schemaVersion: 1, name: String(value.name ?? ''), rows: [] };

  if (value.theme !== undefined) {
    if (!isObj(value.theme)) errors.push('"theme" deve ser um objeto.');
    else {
      out.theme = {};
      for (const k of ['background', 'accent', 'text'] as const) {
        const c = value.theme[k];
        if (c === undefined) continue;
        if (typeof c !== 'string' || !COLOR.test(c)) errors.push(`Cor inválida em theme.${k} (use o formato #RRGGBB).`);
        else out.theme[k] = c;
      }
    }
  }
  if (value.clock !== undefined) {
    if (!isObj(value.clock)) errors.push('"clock" deve ser um objeto.');
    else {
      out.clock = {};
      for (const k of ['show', 'format24h'] as const) {
        const b = value.clock[k];
        if (b === undefined) continue;
        if (typeof b !== 'boolean') errors.push(`clock.${k} deve ser verdadeiro ou falso.`);
        else out.clock[k] = b;
      }
    }
  }
  if (value.iconSize !== undefined) {
    if (!ICON_SIZES.has(value.iconSize as string)) errors.push('iconSize inválido (auto, small, medium ou large).');
    else out.iconSize = value.iconSize as Profile['iconSize'];
  }
  if (value.lightMode !== undefined) {
    if (!LIGHT.has(value.lightMode as string)) errors.push('lightMode inválido (auto, on ou off).');
    else out.lightMode = value.lightMode as Profile['lightMode'];
  }

  if (!Array.isArray(value.rows) || value.rows.length < 1 || value.rows.length > 12) {
    errors.push('O perfil precisa de 1 a 12 fileiras.');
  } else {
    const ids = new Set<string>();
    value.rows.forEach((r, i) => {
      const where = `Fileira ${i + 1}`;
      if (!isObj(r)) return void errors.push(`${where}: precisa ser um objeto.`);
      if (typeof r.id !== 'string' || !ROW_ID.test(r.id)) errors.push(`${where}: id inválido (letras minúsculas, números e hífen).`);
      else if (ids.has(r.id)) errors.push(`${where}: id "${r.id}" repetido.`);
      else ids.add(r.id);
      if (!isStr(r.title, 1, 40)) errors.push(`${where}: título deve ter de 1 a 40 caracteres.`);
      if (!ROW_TYPES.has(r.type as string)) return void errors.push(`${where}: tipo desconhecido "${String(r.type)}".`);
      const row: ProfileRow = { id: String(r.id), title: String(r.title), type: r.type as RowType };
      if (r.type === 'apps') {
        if (!Array.isArray(r.apps)) errors.push(`${where}: fileira de apps precisa da lista "apps".`);
        else if (r.apps.length > 40) errors.push(`${where}: no máximo 40 apps.`);
        else {
          const seen = new Set<string>();
          for (const a of r.apps) {
            if (typeof a !== 'string' || a.length > 255 || !PACKAGE.test(a)) errors.push(`${where}: app inválido ${JSON.stringify(a)}.`);
            else if (seen.has(a)) errors.push(`${where}: app ${a} repetido.`);
            else seen.add(a);
          }
          row.apps = [...seen];
        }
      }
      out.rows.push(row);
    });
  }
  return errors.length ? { ok: false, errors } : { ok: true, profile: out };
}

const DEFAULTS_FILE = new URL('../../../../shared/profile/defaults.json', import.meta.url);

/** Perfil inicial montado a partir do que a TV tem — adaptado a cada aparelho. */
export function defaultProfile(inv: DeviceInventory): Profile {
  const defaults = JSON.parse(fs.readFileSync(DEFAULTS_FILE, 'utf8')) as { favoriteCandidates: string[]; theme: Profile['theme'] };
  const enabled = new Set(inv.packages.filter((p) => p.enabled).map((p) => p.name));
  const userApps = inv.packages.filter((p) => !p.system && p.enabled).map((p) => p.name);
  const favorites = [...new Set([...defaults.favoriteCandidates.filter((p) => enabled.has(p)), ...userApps])].slice(0, 12);
  const hasLiveTv = inv.features.includes('android.software.live_tv');
  const rows: ProfileRow[] = [{ id: 'favoritos', title: 'Favoritos', type: 'apps', apps: favorites }];
  if (hasLiveTv) rows.push({ id: 'entradas', title: 'Entradas (HDMI e antena)', type: 'inputs' });
  rows.push({ id: 'todos', title: 'Todos os apps', type: 'all-apps' });
  return {
    schemaVersion: 1,
    name: `${inv.device.brand} ${inv.device.model}`.slice(0, 60),
    theme: defaults.theme,
    clock: { show: true, format24h: true },
    iconSize: 'auto',
    lightMode: 'auto',
    rows,
  };
}

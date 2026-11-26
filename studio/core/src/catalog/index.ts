// Classificação de segurança dos apps, por camadas: núcleo fixo → marca/fabricante → Android comum →
// heurística → padrão (🟡 desconhecido). Um 🔴 de qualquer camada nunca é rebaixado.
import fs from 'node:fs';

export type SafetyLevel = 'protected' | 'caution' | 'safe';

export interface CatalogEntry {
  level: SafetyLevel;
  label: string;
  description?: string;
  effect?: string;
}

export interface CatalogLayer {
  name: string;
  match?: { brand?: string[]; manufacturer?: string[]; model?: string[] };
  packages: Record<string, CatalogEntry>;
}

export interface Catalog {
  layers: CatalogLayer[]; // a camada "android" é a última
}

export interface DeviceContext {
  brand: string;
  manufacturer: string;
  model: string;
  currentHome: string | null;
}

export interface Classification extends CatalogEntry {
  pkg: string;
  source: string;
}

/** Nunca podem ser desativados, independentemente de qualquer catálogo (defesa em profundidade). */
export const CORE_PROTECTED: readonly (string | RegExp)[] = [
  'android',
  'com.android.systemui',
  'com.android.settings',
  'com.android.tv.settings',
  'com.android.shell',
  'com.android.packageinstaller',
  'com.google.android.packageinstaller',
  'com.android.bluetooth',
  'com.google.android.tv.remote.service',
  'com.google.android.gms',
  'com.google.android.gsf',
  'com.android.webview',
  'com.google.android.webview',
  'com.google.android.tungsten.setupwraith',
  'com.tvsmartadaptative.launcher',
  /^com\.android\.providers\./,
  /^com\.(google\.)?android\.networkstack/,
  /^com\.android\.wifi/,
];

const ESSENTIAL_HINT = /(tvinput|tv\.input|inputservice|inputsource|hdmi|tuner|livetv|remote|bluetooth|inputmethod|keyboard|\.ime$|wifi|network|ethernet|systemui|settings|provider|packageinstaller)/i;
const CAUTION_HINT = /(update|ota|upgrade|setup|launcher|home)/i;

const DEFAULT_DIR = new URL('../../../../shared/catalog/', import.meta.url);

export function loadCatalog(dir: URL = DEFAULT_DIR): Catalog {
  const read = (u: URL) => JSON.parse(fs.readFileSync(u, 'utf8')) as Omit<CatalogLayer, 'name'>;
  const brandsDir = new URL('brands/', dir);
  const brands = fs
    .readdirSync(brandsDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ name: `marca:${f.replace(/\.json$/, '')}`, ...read(new URL(f, brandsDir)) }));
  return { layers: [...brands, { name: 'android', ...read(new URL('android.json', dir)) }] };
}

function layerMatches(layer: CatalogLayer, ctx: DeviceContext): boolean {
  if (!layer.match) return true;
  const eq = (list: string[] | undefined, v: string) => !!list?.some((x) => x.toLowerCase() === v.toLowerCase());
  return eq(layer.match.brand, ctx.brand) || eq(layer.match.manufacturer, ctx.manufacturer) || eq(layer.match.model, ctx.model);
}

function lookup(layer: CatalogLayer, pkg: string): CatalogEntry | null {
  if (layer.packages[pkg]) return layer.packages[pkg]!;
  let best: [number, CatalogEntry] | null = null;
  for (const [key, entry] of Object.entries(layer.packages)) {
    if (!key.endsWith('*')) continue;
    const prefix = key.slice(0, -1);
    if (pkg.startsWith(prefix) && (!best || prefix.length > best[0])) best = [prefix.length, entry];
  }
  return best?.[1] ?? null;
}

export function isCoreProtected(pkg: string): boolean {
  return CORE_PROTECTED.some((p) => (typeof p === 'string' ? p === pkg : p.test(pkg)));
}

export function classifyPackage(pkg: string, ctx: DeviceContext, catalog: Catalog): Classification {
  if (isCoreProtected(pkg)) {
    const fromCatalog = catalog.layers.map((l) => lookup(l, pkg)).find(Boolean);
    return { pkg, level: 'protected', label: fromCatalog?.label ?? pkg, source: 'núcleo', description: 'Essencial para a TV funcionar.' };
  }
  if (ctx.currentHome && pkg === ctx.currentHome) {
    const fromCatalog = catalog.layers.map((l) => lookup(l, pkg)).find(Boolean);
    return {
      pkg, level: 'protected', label: fromCatalog?.label ?? 'Tela inicial atual', source: 'tela-inicial',
      description: 'É a tela inicial em uso. A troca é feita na Fase 4, com cuidados próprios.',
    };
  }

  const hits = catalog.layers
    .filter((l) => layerMatches(l, ctx))
    .map((l) => ({ layer: l.name, entry: lookup(l, pkg) }))
    .filter((h): h is { layer: string; entry: CatalogEntry } => h.entry !== null);

  const protectedHit = hits.find((h) => h.entry.level === 'protected');
  if (protectedHit) return { pkg, ...protectedHit.entry, source: protectedHit.layer };
  if (hits[0]) return { pkg, ...hits[0].entry, source: hits[0].layer }; // a camada mais específica vence

  if (ESSENTIAL_HINT.test(pkg)) {
    return { pkg, level: 'protected', label: pkg, source: 'heurística', description: 'Pelo nome, parece um componente essencial (entrada, rede, controle, configurações).' };
  }
  if (CAUTION_HINT.test(pkg)) {
    return { pkg, level: 'caution', label: pkg, source: 'heurística', effect: 'Pelo nome, pode ser atualização do sistema ou tela inicial.' };
  }
  return { pkg, level: 'caution', label: pkg, source: 'desconhecido', effect: 'App que ainda não conhecemos. Desative só se souber o que é.' };
}

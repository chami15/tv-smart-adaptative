import { createHash } from 'node:crypto';
import type { DeviceShell } from '../adb/executor.ts';
import { AdbError } from '../adb/errors.ts';
import { androidCapabilities } from '../drivers/android.ts';
import { detectPlatform } from '../drivers/detect.ts';
import { type CapabilityStatus, PLATFORM_LABEL, type PlatformId } from '../drivers/types.ts';
import { classifyRam, classifyResolution, type RamClass, type ResolutionClass } from './classes.ts';
import * as P from './parsers.ts';

export const INVENTORY_SCHEMA_VERSION = 1;

export interface PackageInfo {
  name: string;
  system: boolean;
  enabled: boolean;
}

export interface DeviceInventory {
  schemaVersion: number;
  capturedAt: string;
  /** Identificador anônimo e estável do aparelho (hash) — o número de série nunca é guardado. */
  deviceId: string;
  device: {
    brand: string;
    manufacturer: string;
    model: string;
    deviceCode: string;
    androidVersion: string;
    apiLevel: number | null;
    platform: PlatformId;
    platformLabel: string;
    supported: boolean;
    supportReason: string;
    hasGoogleServices: boolean;
    chipset: string;
  };
  memory: { totalKb: number | null; availableKb: number | null; ramClass: RamClass };
  display: { width: number | null; height: number | null; density: number | null; resolutionClass: ResolutionClass };
  currentHome: P.ComponentName | null;
  packages: PackageInfo[];
  processes: P.ProcessMemory[];
  capabilities: CapabilityStatus[];
  /** Somente propriedades sem dados pessoais (lista fixa abaixo). */
  props: Record<string, string>;
  warnings: string[];
}

/** Propriedades que podem ser guardadas. Nada de serial, hostname, MAC, contas, Wi-Fi. */
export const SAFE_PROPS = [
  'ro.build.version.release', 'ro.build.version.sdk', 'ro.build.version.name', 'ro.build.version.security_patch',
  'ro.product.brand', 'ro.product.manufacturer', 'ro.product.model', 'ro.product.device', 'ro.product.name',
  'ro.build.characteristics', 'ro.build.type', 'ro.build.display.id', 'ro.build.fingerprint',
  'ro.hardware', 'ro.board.platform', 'ro.product.cpu.abi', 'persist.sys.locale', 'ro.config.low_ram',
] as const;

/** Erros que significam "a conexão acabou": não adianta continuar a leitura. */
const FATAL: ReadonlySet<string> = new Set(['DEVICE_OFFLINE', 'DEVICE_NOT_FOUND', 'DEVICE_UNAUTHORIZED', 'ADB_NOT_FOUND']);

export async function collectInventory(shell: DeviceShell, now = new Date()): Promise<DeviceInventory> {
  const warnings: string[] = [];

  // getprop é essencial: se falhar, o erro sobe.
  const allProps = P.parseGetprop(await shell.getprop());

  const optional = async <T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof AdbError && FATAL.has(err.code)) throw err;
      warnings.push(`Não foi possível ler ${label}.`);
      return fallback;
    }
  };

  const features = await optional('os recursos do sistema', async () => P.parseFeatures(await shell.listFeatures()), []);
  const all = await optional('a lista de apps', async () => P.parsePackageList(await shell.listPackages()), []);
  const system = new Set(await optional('os apps de sistema', async () => P.parsePackageList(await shell.listPackages('-s')), []));
  const disabled = new Set(await optional('os apps desativados', async () => P.parsePackageList(await shell.listPackages('-d')), []));
  const mem = await optional('a memória', async () => P.parseProcMeminfo(await shell.procMeminfo()), { totalKb: null, availableKb: null });
  const size = await optional('a resolução', async () => P.parseWmSize(await shell.wmSize()), null);
  const density = await optional('a densidade da tela', async () => P.parseWmDensity(await shell.wmDensity()), null);
  const home = await optional('a tela inicial atual', async () => P.parseResolveHome(await shell.resolveHome()), null);
  const processes = await optional('o uso de memória por app', async () => P.parseDumpsysMeminfo(await shell.dumpsysMeminfo()), []);

  if (Object.keys(allProps).length === 0) warnings.push('As informações do aparelho vieram vazias ou corrompidas.');
  if (all.length === 0) warnings.push('Nenhum app foi listado — a resposta da TV pode estar incompleta.');

  const detection = detectPlatform({ props: allProps, features, packages: all });
  const sdk = Number(allProps['ro.build.version.sdk']);

  const props: Record<string, string> = {};
  for (const key of SAFE_PROPS) if (allProps[key] !== undefined) props[key] = allProps[key];

  return {
    schemaVersion: INVENTORY_SCHEMA_VERSION,
    capturedAt: now.toISOString(),
    deviceId: anonymousId(allProps),
    device: {
      brand: allProps['ro.product.brand'] || 'Desconhecida',
      manufacturer: allProps['ro.product.manufacturer'] || 'Desconhecido',
      model: allProps['ro.product.model'] || 'Desconhecido',
      deviceCode: allProps['ro.product.device'] || '',
      androidVersion: allProps['ro.build.version.release'] || '?',
      apiLevel: Number.isFinite(sdk) && sdk > 0 ? sdk : null,
      platform: detection.platform,
      platformLabel: PLATFORM_LABEL[detection.platform],
      supported: detection.supported,
      supportReason: detection.reason,
      hasGoogleServices: detection.hasGoogleServices,
      chipset: allProps['ro.board.platform'] || allProps['ro.hardware'] || '',
    },
    memory: { ...mem, ramClass: classifyRam(mem.totalKb) },
    display: {
      width: size?.width ?? null,
      height: size?.height ?? null,
      density,
      resolutionClass: classifyResolution(size),
    },
    currentHome: home,
    packages: all
      .map((name) => ({ name, system: system.has(name), enabled: !disabled.has(name) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    processes: processes.slice(0, 30),
    capabilities: androidCapabilities(detection),
    props,
    warnings,
  };
}

/** Hash estável para separar backups de TVs diferentes sem guardar o serial. */
export function anonymousId(props: Record<string, string>): string {
  const basis = props['ro.serialno'] || props['ro.boot.serialno'] || props['ro.build.fingerprint'] || props['ro.product.model'] || 'desconhecido';
  return createHash('sha256').update('tvsa:v1:' + basis).digest('hex').slice(0, 12);
}

// Gera as saídas de texto que o adb real produziria, a partir da especificação do aparelho.
import type { FakeDeviceSpec } from './types.ts';

export function renderGetprop(spec: FakeDeviceSpec): string {
  return Object.entries(spec.props)
    .map(([k, v]) => `[${k}]: [${v}]`)
    .join('\n') + '\n';
}

export function renderPackages(spec: FakeDeviceSpec, flags: readonly string[]): string {
  let list = spec.packages;
  if (flags.includes('-s')) list = list.filter((p) => p.system);
  if (flags.includes('-3')) list = list.filter((p) => !p.system);
  if (flags.includes('-d')) list = list.filter((p) => !p.enabled);
  if (flags.includes('-e')) list = list.filter((p) => p.enabled);
  return list.map((p) => `package:${p.name}`).join('\n') + '\n';
}

export function renderFeatures(spec: FakeDeviceSpec): string {
  return spec.features.join('\n') + '\n';
}

export function renderProcMeminfo(spec: FakeDeviceSpec): string {
  const { totalKb, freeKb, availableKb } = spec.memory;
  const pad = (n: number) => String(n).padStart(8, ' ');
  return [
    `MemTotal:       ${pad(totalKb)} kB`,
    `MemFree:        ${pad(freeKb)} kB`,
    `MemAvailable:   ${pad(availableKb)} kB`,
    `Buffers:        ${pad(12_000)} kB`,
    `Cached:         ${pad(availableKb - freeKb)} kB`,
    `SwapTotal:      ${pad(512_000)} kB`,
    `SwapFree:       ${pad(300_000)} kB`,
  ].join('\n') + '\n';
}

export function renderDumpsysMeminfo(spec: FakeDeviceSpec): string {
  const fmt = (kb: number) => `${kb.toLocaleString('en-US')}K`;
  const lines = ['Applications Memory Usage (in Kilobytes):', 'Uptime: 123456 Realtime: 123456', '', 'Total PSS by process:'];
  spec.processes
    .slice()
    .sort((a, b) => b.pssKb - a.pssKb)
    .forEach((p, i) => lines.push(`    ${fmt(p.pssKb).padStart(10)}: ${p.name} (pid ${1000 + i * 37} / activities)`));
  lines.push('', 'Total PSS by OOM adjustment:', `    ${fmt(400_000)}: Native`, '');
  lines.push(`Total RAM: ${fmt(spec.memory.totalKb)} (status normal)`);
  lines.push(` Free RAM: ${fmt(spec.memory.availableKb)}`);
  return lines.join('\n') + '\n';
}

export function renderWmSize(spec: FakeDeviceSpec): string {
  return `Physical size: ${spec.display.width}x${spec.display.height}\n`;
}

export function renderWmDensity(spec: FakeDeviceSpec): string {
  return `Physical density: ${spec.display.density}\n`;
}

export function renderResolveHome(spec: FakeDeviceSpec): string {
  if (!spec.home) return 'No activity found\n';
  return `priority=0 preferredOrder=0 match=0x108000 specificIndex=-1 isDefault=true\n${spec.home}\n`;
}

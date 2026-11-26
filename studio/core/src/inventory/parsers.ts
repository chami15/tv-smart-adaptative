// Parsers tolerantes: nunca lançam exceção com saída estranha — devolvem o que conseguirem entender.
import { isValidPackageName } from '../adb/validate.ts';

export function parseGetprop(text: string): Record<string, string> {
  const props: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(/^\[([^\]\s]+)\]:\s*\[(.*)$/);
    if (!m) continue;
    let value = m[2]!;
    // valores multilinha: continua até achar o "]" final
    while (!value.endsWith(']') && i + 1 < lines.length) value += '\n' + lines[++i];
    if (!value.endsWith(']')) continue;
    props[m[1]!] = value.slice(0, -1);
  }
  return props;
}

export function parsePackageList(text: string): string[] {
  const names = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith('package:')) continue;
    let body = line.slice('package:'.length).split(/\s+/)[0] ?? '';
    if (body.includes('=')) body = body.slice(body.lastIndexOf('=') + 1); // formato -f
    if (body === 'android' || isValidPackageName(body)) names.add(body);
  }
  return [...names];
}

export function parseFeatures(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.trim().match(/^feature:([\w.]+)/);
    if (m) out.push(m[1]!);
  }
  return out;
}

export interface MemInfo {
  totalKb: number | null;
  availableKb: number | null;
}

export function parseProcMeminfo(text: string): MemInfo {
  const get = (key: string): number | null => {
    const m = text.match(new RegExp(`^${key}:\\s*(\\d+)\\s*kB`, 'm'));
    return m ? Number(m[1]) : null;
  };
  const total = get('MemTotal');
  let available = get('MemAvailable');
  if (available === null) {
    const free = get('MemFree');
    const cached = get('Cached');
    available = free !== null ? free + (cached ?? 0) : null;
  }
  return { totalKb: total, availableKb: available };
}

export interface ProcessMemory {
  name: string;
  kb: number;
}

/** Lê a seção "Total PSS by process" (ou "Total RSS by process" em Androids novos). */
export function parseDumpsysMeminfo(text: string): ProcessMemory[] {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^Total (PSS|RSS) by process:/.test(l.trim()));
  if (start < 0) return [];
  const out: ProcessMemory[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) break;
    const m = line.match(/^([\d,]+)K(?:B)?:\s+(\S+)\s+\(pid\s+\d+/);
    if (m) out.push({ name: m[2]!, kb: Number(m[1]!.replace(/,/g, '')) });
  }
  return out.sort((a, b) => b.kb - a.kb);
}

export interface DisplaySize {
  width: number;
  height: number;
}

export function parseWmSize(text: string): DisplaySize | null {
  const m = text.match(/Override size:\s*(\d+)x(\d+)/) ?? text.match(/Physical size:\s*(\d+)x(\d+)/);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

export function parseWmDensity(text: string): number | null {
  const m = text.match(/Override density:\s*(\d+)/) ?? text.match(/Physical density:\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

export interface ComponentName {
  package: string;
  activity: string;
}

export function parseResolveHome(text: string): ComponentName | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).reverse();
  for (const line of lines) {
    const m = line.match(/^([a-zA-Z][\w.]*)\/([\w.$]+)$/);
    if (m) {
      const pkg = m[1]!;
      const act = m[2]!.startsWith('.') ? pkg + m[2] : m[2]!;
      return { package: pkg, activity: act };
    }
  }
  return null;
}

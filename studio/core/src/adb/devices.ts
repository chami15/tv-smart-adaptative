export type DeviceState = 'device' | 'unauthorized' | 'offline' | 'authorizing' | 'connecting' | 'unknown';

export interface AdbDeviceEntry {
  serial: string;
  state: DeviceState;
  model?: string;
  product?: string;
}

const KNOWN: ReadonlySet<string> = new Set(['device', 'unauthorized', 'offline', 'authorizing', 'connecting']);

/** Interpreta a saída de `adb devices -l`. Tolerante a linhas extras e CRLF. */
export function parseDevicesOutput(output: string): AdbDeviceEntry[] {
  const result: AdbDeviceEntry[] = [];
  for (const raw of output.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('*') || line.startsWith('List of devices')) continue;
    const parts = line.split(/\s+/);
    const [serial, state] = parts;
    if (!serial || !state) continue;
    const entry: AdbDeviceEntry = { serial, state: KNOWN.has(state) ? (state as DeviceState) : 'unknown' };
    for (const kv of parts.slice(2)) {
      const [k, v] = kv.split(':');
      if (k === 'model' && v) entry.model = v.replace(/_/g, ' ');
      if (k === 'product' && v) entry.product = v;
    }
    result.push(entry);
  }
  return result;
}

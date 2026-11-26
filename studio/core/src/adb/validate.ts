// Validação estrita de tudo que vai para a linha de comando.
// IMPORTANTE: `adb shell a b c` junta os argumentos e entrega para o shell da TV,
// então NENHUM caractere especial de shell pode passar.

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const HOSTNAME = /^(?=.{1,253}$)[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export function isValidHost(host: string): boolean {
  return IPV4.test(host) || (HOSTNAME.test(host) && !/^\d+(\.\d+)*$/.test(host));
}

export function isValidPort(port: number | string): boolean {
  const n = typeof port === 'string' ? Number(port) : port;
  return Number.isInteger(n) && n >= 1 && n <= 65535 && String(n) === String(port).trim();
}

export function isValidHostPort(value: string): boolean {
  const i = value.lastIndexOf(':');
  if (i <= 0) return false;
  return isValidHost(value.slice(0, i)) && isValidPort(value.slice(i + 1));
}

export function isValidPairingCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/** Nome de pacote Android: segmentos [a-zA-Z][a-zA-Z0-9_]* separados por ponto. */
export function isValidPackageName(name: string): boolean {
  return name.length <= 255 && /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(name);
}

/** Serial do adb: host:porta (rede), serial USB alfanumérico ou nome mDNS do adb. */
export function isValidSerial(serial: string): boolean {
  return (
    isValidHostPort(serial) ||
    /^[a-zA-Z0-9]{4,64}$/.test(serial) ||
    /^adb-[a-zA-Z0-9-]{1,64}\._adb-tls-connect\._tcp\.?$/.test(serial)
  );
}

export function isValidPropKey(key: string): boolean {
  return /^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_-]+)*$/.test(key) && key.length <= 128;
}

/** Nenhum token pode conter caracteres que o shell da TV interpretaria. */
export function isShellSafeToken(token: string): boolean {
  return /^[a-zA-Z0-9_.\-\/:=@]+$/.test(token);
}

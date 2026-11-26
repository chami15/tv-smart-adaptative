// Interpreta o que o usuário digita no campo de IP, perdoando erros comuns.
export interface ParsedAddress {
  host: string;
  port: number | null;
}

export function parseAddress(input: string): ParsedAddress | { error: string } {
  let s = input.trim().replace(/^(adb\s+connect\s+|https?:\/\/)/i, '').replace(/\/+$/, '');
  if (!s) return { error: 'Digite o endereço IP da TV.' };
  // teclado brasileiro: "192,168,0,25" → "192.168.0.25"
  if (/^\d{1,3}(,\d{1,3}){3}(:\d+)?$/.test(s)) s = s.replace(/,/g, '.');
  // espaços só são perdoados dentro de um IP ("192.168.0. 25"); em nomes viram erro
  if (/^[\d.\s:]+$/.test(s)) s = s.replace(/\s+/g, '');
  else if (/\s/.test(s)) return { error: 'Endereço inválido. Use o IP que aparece nas configurações de rede da TV, ex.: 192.168.0.25' };
  let port: number | null = null;
  const m = s.match(/^(.*):(\d{1,5})$/);
  if (m) {
    s = m[1]!;
    port = Number(m[2]);
    if (port < 1 || port > 65535) return { error: 'A porta deve estar entre 1 e 65535.' };
  }
  const ipv4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
  if (/^[\d.]+$/.test(s)) {
    if (!ipv4.test(s)) return { error: 'Esse IP não parece completo. O formato é parecido com 192.168.0.25' };
    return { host: s, port };
  }
  if (/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(s)) return { host: s, port };
  return { error: 'Endereço inválido. Use o IP que aparece nas configurações de rede da TV, ex.: 192.168.0.25' };
}

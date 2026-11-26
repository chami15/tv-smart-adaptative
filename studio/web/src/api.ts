// Cliente da API local. O token vem no #fragmento da URL aberta pelo Studio
// e fica só nesta aba (sessionStorage); o fragmento é apagado da barra de endereço.
const KEY = 'tvsa-token';

export function readToken(): string | null {
  const m = window.location.hash.match(/token=([A-Za-z0-9_-]+)/);
  if (m) {
    try {
      sessionStorage.setItem(KEY, m[1]!);
    } catch {
      /* navegação privada: segue só em memória */
    }
    history.replaceState(null, '', window.location.pathname + window.location.search);
    memoryToken = m[1]!;
    return memoryToken;
  }
  if (memoryToken) return memoryToken;
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

let memoryToken: string | null = null;

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const token = readToken();
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: {
        authorization: `Bearer ${token ?? ''}`,
        ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
      },
      ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}),
    });
  } catch {
    throw new ApiError(0, 'STUDIO_OFFLINE', 'O Studio parou de responder. A janela preta do Studio ainda está aberta?');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error;
    throw new ApiError(res.status, err?.code ?? 'UNKNOWN', err?.message ?? 'Erro inesperado.');
  }
  return data as T;
}

export type RamClass = 'low' | 'medium' | 'high' | 'unknown';
export type ResolutionClass = 'sd' | '720p' | '1080p' | '4k' | 'unknown';

export const RAM_LABEL: Record<RamClass, string> = {
  low: 'Pouca memória (modo leve recomendado)',
  medium: 'Memória média',
  high: 'Bastante memória',
  unknown: 'Memória desconhecida',
};

/** Limites em kB. TVs de "2 GB" reportam ~1,9 GB de total utilizável. */
export function classifyRam(totalKb: number | null): RamClass {
  if (!totalKb || totalKb <= 0) return 'unknown';
  const gb = totalKb / 1024 / 1024;
  if (gb < 2.5) return 'low';
  if (gb < 4.5) return 'medium';
  return 'high';
}

export function classifyResolution(size: { width: number; height: number } | null): ResolutionClass {
  if (!size) return 'unknown';
  const short = Math.min(size.width, size.height);
  if (short >= 2160) return '4k';
  if (short >= 1080) return '1080p';
  if (short >= 720) return '720p';
  return 'sd';
}

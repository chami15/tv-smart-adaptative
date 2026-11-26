export function formatMemory(kb: number | null): string {
  if (kb === null) return '?';
  const mb = kb / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1).replace('.', ',')} GB` : `${Math.round(mb)} MB`;
}

export const RAM_LABEL = {
  low: 'Pouca memória — modo leve recomendado',
  medium: 'Memória média',
  high: 'Bastante memória',
  unknown: 'Memória desconhecida',
} as const;

export const RESOLUTION_LABEL: Record<string, string> = {
  '4k': '4K (Ultra HD)',
  '1080p': 'Full HD (1080p)',
  '720p': 'HD (720p)',
  sd: 'SD',
  unknown: 'desconhecida',
};

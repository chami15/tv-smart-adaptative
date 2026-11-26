import type { Detection, DetectionInput } from './types.ts';

/**
 * Descobre que tipo de aparelho é, sem depender de marca:
 * usa recursos declarados pelo sistema (features), propriedades e pacotes-chave do Google.
 */
export function detectPlatform({ props, features, packages }: DetectionInput): Detection {
  const f = new Set(features);
  const p = new Set(packages);
  const characteristics = (props['ro.build.characteristics'] ?? '').split(',');
  const manufacturer = (props['ro.product.manufacturer'] ?? '').toLowerCase();
  const hasGoogleServices = p.has('com.google.android.gms');

  if (Object.keys(props).length === 0) {
    return { platform: 'unknown', supported: false, isTv: false, hasGoogleServices, reason: 'Não foi possível ler as informações do aparelho.' };
  }

  const isTv =
    f.has('android.software.leanback') ||
    f.has('android.hardware.type.television') ||
    characteristics.includes('tv');

  const isFire =
    f.has('amazon.hardware.fire_tv') || manufacturer === 'amazon' || /^fire os/i.test(props['ro.build.version.name'] ?? '');
  if (isFire) {
    return { platform: 'fire-os', supported: false, isTv: true, hasGoogleServices, reason: 'Fire TV ainda não é suportada (planejada para depois). Você pode ver as informações, mas nada será alterado.' };
  }
  if (!isTv) {
    return { platform: 'android-non-tv', supported: false, isTv: false, hasGoogleServices, reason: 'Este aparelho não parece ser uma TV (sem suporte a interface de TV/leanback).' };
  }
  const isGoogleTv = p.has('com.google.android.apps.tv.launcherx') || f.has('com.google.android.tv.installed');
  return {
    platform: isGoogleTv ? 'google-tv' : 'android-tv',
    supported: true,
    isTv: true,
    hasGoogleServices,
    reason: isGoogleTv ? 'Google TV detectada.' : 'Android TV detectada.',
  };
}

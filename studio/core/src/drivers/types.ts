export type PlatformId = 'google-tv' | 'android-tv' | 'fire-os' | 'android-non-tv' | 'unknown';

export const PLATFORM_LABEL: Record<PlatformId, string> = {
  'google-tv': 'Google TV',
  'android-tv': 'Android TV',
  'fire-os': 'Fire TV (Fire OS)',
  'android-non-tv': 'Android (não é uma TV)',
  unknown: 'Desconhecida',
};

export type CapabilityId = 'readInventory' | 'snapshot' | 'disableApps' | 'installLauncher' | 'takeOverHome' | 'pushProfile';

export interface CapabilityStatus {
  id: CapabilityId;
  label: string;
  status: 'available' | 'planned' | 'unsupported';
  detail: string;
  /** Fase do roadmap em que fica disponível. */
  phase?: number;
}

export interface DetectionInput {
  props: Record<string, string>;
  features: string[];
  packages: string[];
}

export interface Detection {
  platform: PlatformId;
  supported: boolean;
  isTv: boolean;
  hasGoogleServices: boolean;
  reason: string;
}

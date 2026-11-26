// Espelho dos tipos de studio/core (a página não importa código Node).
export type DeviceState = 'device' | 'unauthorized' | 'offline' | 'authorizing' | 'connecting' | 'unknown';

export interface AdbDeviceEntry {
  serial: string;
  state: DeviceState;
  model?: string;
}

export interface StudioStatus {
  mode: 'real' | 'fake';
  adb: { found: boolean; path: string | null; version: string | null };
  devices: AdbDeviceEntry[];
  dataDir: string;
  fakeNetwork?: { host: string; scenario: string }[];
}

export interface CapabilityStatus {
  id: string;
  label: string;
  status: 'available' | 'planned' | 'unsupported';
  detail: string;
  phase?: number;
}

export interface DeviceInventory {
  capturedAt: string;
  deviceId: string;
  device: {
    brand: string;
    manufacturer: string;
    model: string;
    androidVersion: string;
    apiLevel: number | null;
    platform: string;
    platformLabel: string;
    supported: boolean;
    supportReason: string;
    hasGoogleServices: boolean;
    chipset: string;
  };
  memory: { totalKb: number | null; availableKb: number | null; ramClass: 'low' | 'medium' | 'high' | 'unknown' };
  display: { width: number | null; height: number | null; density: number | null; resolutionClass: string };
  currentHome: { package: string; activity: string } | null;
  packages: { name: string; system: boolean; enabled: boolean }[];
  processes: { name: string; kb: number }[];
  capabilities: CapabilityStatus[];
  warnings: string[];
}

export interface SnapshotSummary {
  dir: string;
  createdAt: string;
  device: string;
}

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
  version?: { running: string; onDisk: string; updateAvailable: boolean };
  writes?: { allowed: boolean; reason?: string };
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
  deviceId: string;
  reason: string;
}

export interface DiscoveredTv {
  host: string;
  name: string | null;
  model: string | null;
  adbPort: number | null;
  debuggingEnabled: boolean;
  sources: string[];
}

export interface DiscoveryResult {
  networks: { interfaceName: string; address: string; prefix24: string }[];
  tvs: DiscoveredTv[];
  durationMs: number;
}

export type SafetyLevel = 'protected' | 'caution' | 'safe';

export interface CleanupItem {
  pkg: string;
  label: string;
  level: SafetyLevel;
  description?: string;
  effect?: string;
  enabled: boolean;
  memoryKb: number | null;
}

export interface PlanAction {
  kind: 'disable' | 'enable';
  pkg: string;
  label: string;
  level: SafetyLevel;
  effect?: string;
  estimatedKb: number | null;
}

export interface ChangePlan {
  id: string;
  kind: 'cleanup' | 'restore' | 'undo';
  title: string;
  serial: string;
  deviceId: string;
  actions: PlanAction[];
  hash: string;
}

export interface Rejection {
  pkg: string;
  reason: string;
}

export interface PlanResponse {
  plan: ChangePlan | null;
  rejected: Rejection[];
  error?: string;
}

export interface JournalStep {
  kind: 'disable' | 'enable';
  pkg: string;
  label: string;
  status: string;
  error?: string;
}

export interface ExecutionResult {
  planId: string;
  status: 'completed' | 'rolled-back' | 'rollback-failed' | 'interrupted' | 'refused';
  message: string;
  steps: JournalStep[];
  snapshotDir?: string;
  memoryBeforeKb?: number | null;
  memoryAfterKb?: number | null;
  problems?: Rejection[];
}

export interface PendingChange {
  planId: string;
  title: string;
  deviceId: string;
  status: string;
  message?: string;
  startedAt: string;
}

// Driver da família Android (Google TV, Android TV e, por enquanto só para leitura, Fire OS/outros).
import type { DeviceShell } from '../adb/executor.ts';
import { type DeviceInventory, collectInventory } from '../inventory/collect.ts';
import type { CapabilityStatus, Detection, PlatformId } from './types.ts';

export interface TvDriver {
  readonly family: 'android';
  readInventory(now?: Date): Promise<DeviceInventory>;
}

export function androidCapabilities(detection: Detection): CapabilityStatus[] {
  const ok = detection.supported;
  const no = (id: CapabilityStatus['id'], label: string): CapabilityStatus => ({
    id, label, status: 'unsupported', detail: detection.reason,
  });
  const read: CapabilityStatus[] = [
    { id: 'readInventory', label: 'Ver informações e apps', status: 'available', detail: 'Somente leitura.' },
    { id: 'snapshot', label: 'Salvar backup do estado atual', status: 'available', detail: 'Salvo no seu computador.' },
  ];
  if (!ok) {
    return [...read, no('disableApps', 'Limpar memória (desativar apps)'), no('installLauncher', 'Instalar a nova tela inicial'), no('takeOverHome', 'Assumir o botão Home'), no('pushProfile', 'Enviar layout montado')];
  }
  return [
    ...read,
    { id: 'disableApps', label: 'Limpar memória (desativar apps)', status: 'planned', phase: 3, detail: 'Desativa apps de forma reversível (pm disable-user).' },
    { id: 'installLauncher', label: 'Instalar a nova tela inicial', status: 'planned', phase: 4, detail: 'Instalada como app comum, sem root.' },
    {
      id: 'takeOverHome', label: 'Assumir o botão Home', status: 'planned', phase: 4,
      detail: homeStrategy(detection.platform),
    },
    { id: 'pushProfile', label: 'Enviar layout montado', status: 'planned', phase: 6, detail: 'Um clique, com volta automática se algo falhar.' },
  ];
}

function homeStrategy(platform: PlatformId): string {
  return platform === 'google-tv'
    ? 'No Google TV: desativando a tela inicial original (reversível, a busca por voz pode parar).'
    : 'Escolhendo a nova tela inicial como padrão, ou desativando a original (reversível).';
}

export class AndroidFamilyDriver implements TvDriver {
  readonly family = 'android' as const;
  private readonly shell: DeviceShell;
  constructor(shell: DeviceShell) {
    this.shell = shell;
  }
  readInventory(now = new Date()): Promise<DeviceInventory> {
    return collectInventory(this.shell, now);
  }
}

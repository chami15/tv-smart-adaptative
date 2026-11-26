export interface FakePackage {
  name: string;
  system: boolean;
  enabled: boolean;
}

export interface FakeBehavior {
  /** 'accept': autoriza depois de `acceptAfterPolls` consultas; 'never': usuário nunca aceita na TV. */
  auth?: 'accept' | 'never';
  acceptAfterPolls?: number;
  /** Depuração desligada na TV: conexão recusada. */
  refuseConnection?: boolean;
  /** Toda chamada estoura o tempo. */
  timeout?: boolean;
  /** Depois de N comandos de shell a TV fica offline (cabo/rede caiu). */
  dropAfterCommands?: number;
  /** Respostas truncadas/estranhas. */
  garbage?: boolean;
}

export interface FakeDeviceSpec {
  id: string;
  description: string;
  simulated: true;
  props: Record<string, string>;
  features: string[];
  packages: FakePackage[];
  memory: { totalKb: number; availableKb: number; freeKb: number };
  processes: { name: string; pssKb: number }[];
  display: { width: number; height: number; density: number };
  home: string | null;
  behavior?: FakeBehavior;
}

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
  /** A N-ésima escrita (1 = primeira) falha com erro de permissão. */
  failWriteAt?: number;
  /** Depois de N escritas a TV fica offline (rede caiu / TV desligou no meio). */
  dropAfterWrites?: number;
  /** A queda de rede acontece uma vez só (ao reconectar, volta a funcionar). */
  dropOnce?: boolean;
  /** A TV responde "sucesso" mas não muda nada (a conferência tem que pegar). */
  lieOnWrite?: boolean;
  /** Efeito colateral: desativar a chave também desativa o valor (a checagem de saúde tem que pegar). */
  sideEffectDisable?: Record<string, string>;
  /** Apps que a TV recusa desativar (proteção do fabricante). */
  denyWrite?: string[];
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

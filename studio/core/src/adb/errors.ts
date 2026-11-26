export type AdbErrorCode =
  | 'ADB_NOT_FOUND'
  | 'COMMAND_REFUSED'
  | 'INVALID_ARGUMENT'
  | 'TIMEOUT'
  | 'CONNECTION_FAILED'
  | 'HOST_UNREACHABLE'
  | 'CONNECTION_REFUSED'
  | 'DEVICE_UNAUTHORIZED'
  | 'DEVICE_OFFLINE'
  | 'DEVICE_NOT_FOUND'
  | 'PAIRING_FAILED'
  | 'UNEXPECTED_OUTPUT'
  | 'UNKNOWN';

export class AdbError extends Error {
  readonly code: AdbErrorCode;
  readonly detail: string | undefined;
  constructor(code: AdbErrorCode, message: string, detail?: string) {
    super(message);
    this.name = 'AdbError';
    this.code = code;
    this.detail = detail;
  }
}

/** Mensagens em português para mostrar ao usuário. */
export const USER_MESSAGES: Record<AdbErrorCode, string> = {
  ADB_NOT_FOUND: 'O programa "adb" (Android Platform-Tools) não foi encontrado neste computador.',
  COMMAND_REFUSED: 'Comando recusado pela trava de segurança do Studio.',
  INVALID_ARGUMENT: 'Algum dado informado é inválido.',
  TIMEOUT: 'A TV demorou demais para responder.',
  CONNECTION_FAILED: 'Não foi possível conectar à TV.',
  HOST_UNREACHABLE: 'A TV não foi encontrada nesse endereço. Confira o IP e se a TV está ligada na mesma rede.',
  CONNECTION_REFUSED:
    'A TV recusou a conexão. Verifique se a depuração (USB/rede) está ativada nas Opções do desenvolvedor.',
  DEVICE_UNAUTHORIZED: 'A TV ainda não autorizou este computador. Aceite o aviso "Permitir depuração?" na tela da TV.',
  DEVICE_OFFLINE: 'A TV ficou offline. Verifique se ela continua ligada e conectada à rede.',
  DEVICE_NOT_FOUND: 'A TV não está conectada ao Studio. Conecte novamente.',
  PAIRING_FAILED: 'O pareamento falhou. Confira o código e a porta mostrados na tela da TV.',
  UNEXPECTED_OUTPUT: 'A TV respondeu de um jeito inesperado.',
  UNKNOWN: 'Ocorreu um erro inesperado ao falar com a TV.',
};

/** Classifica a saída de erro do adb (as mensagens do adb são em inglês). */
export function classifyAdbFailure(output: string): AdbErrorCode | null {
  const text = output.toLowerCase();
  if (/unauthorized|failed to authenticate/.test(text)) return 'DEVICE_UNAUTHORIZED';
  if (/device offline|device '.*' offline|error: closed/.test(text)) return 'DEVICE_OFFLINE';
  if (/no devices\/emulators found|device '.*' not found|device not found/.test(text)) return 'DEVICE_NOT_FOUND';
  if (/connection refused/.test(text)) return 'CONNECTION_REFUSED';
  if (/no route to host|network is unreachable|host is unreachable|unknown host|no such host/.test(text))
    return 'HOST_UNREACHABLE';
  if (/timed out|timeout/.test(text)) return 'TIMEOUT';
  if (/failed to connect|cannot connect|unable to connect/.test(text)) return 'CONNECTION_FAILED';
  if (/pairing|failed: /.test(text) && !/successfully paired/.test(text)) return 'PAIRING_FAILED';
  return null;
}

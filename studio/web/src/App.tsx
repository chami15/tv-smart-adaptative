import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, call, readToken } from './api.ts';
import { AdbMissing } from './components/AdbMissing.tsx';
import { ConnectWizard } from './components/ConnectWizard.tsx';
import { MyTv } from './components/MyTv.tsx';
import { Notice } from './components/Notice.tsx';
import type { DeviceInventory, StudioStatus } from './types.ts';

type View =
  | { kind: 'connect'; message?: string }
  | { kind: 'waiting'; serial: string; since: number }
  | { kind: 'loading'; serial: string }
  | { kind: 'tv'; serial: string; inventory: DeviceInventory };

const WAIT_LIMIT_MS = 90_000;

export function App() {
  const [token] = useState(() => readToken());
  const [status, setStatus] = useState<StudioStatus | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: 'connect' });
  const viewRef = useRef(view);
  viewRef.current = view;

  const refreshStatus = useCallback(async () => {
    try {
      const s = await call<StudioStatus>('GET', '/api/status');
      setStatus(s);
      setFatal(null);
      return s;
    } catch (err) {
      setFatal(err instanceof ApiError ? err.message : String(err));
      return null;
    }
  }, []);

  const loadInventory = useCallback(async (serial: string) => {
    setView({ kind: 'loading', serial });
    try {
      const inventory = await call<DeviceInventory>('POST', '/api/inventory', { serial });
      setView({ kind: 'tv', serial, inventory });
    } catch (err) {
      setView({ kind: 'connect', message: err instanceof ApiError ? err.message : 'Falha ao ler a TV.' });
    }
  }, []);

  // Status inicial + acompanhamento enquanto espera a TV autorizar.
  useEffect(() => {
    if (!token) return;
    void refreshStatus();
    const id = setInterval(async () => {
      const v = viewRef.current;
      if (v.kind !== 'connect' && v.kind !== 'waiting') return;
      const s = await refreshStatus();
      if (!s || v.kind !== 'waiting') return;
      const dev = s.devices.find((d) => d.serial === v.serial);
      if (dev?.state === 'device') void loadInventory(v.serial);
      else if (!dev) setView({ kind: 'connect', message: 'A conexão com a TV foi perdida. Tente conectar de novo.' });
      else if (dev.state === 'offline') setView({ kind: 'connect', message: 'A TV ficou offline. Verifique se ela está ligada e na mesma rede.' });
      else if (Date.now() - v.since > WAIT_LIMIT_MS)
        setView({ kind: 'connect', message: 'A TV não autorizou a conexão a tempo. Conecte de novo e aceite o aviso na tela da TV.' });
    }, 1500);
    return () => clearInterval(id);
  }, [token, refreshStatus, loadInventory]);

  const onConnected = useCallback(
    async (serial: string) => {
      const s = await refreshStatus();
      const dev = s?.devices.find((d) => d.serial === serial);
      if (dev?.state === 'device') void loadInventory(serial);
      else setView({ kind: 'waiting', serial, since: Date.now() });
    },
    [refreshStatus, loadInventory],
  );

  const onDisconnect = useCallback(
    async (serial: string) => {
      try {
        await call('POST', '/api/disconnect', { serial });
      } catch {
        /* já estava desconectada */
      }
      setView({ kind: 'connect' });
      void refreshStatus();
    },
    [refreshStatus],
  );

  if (!token) {
    return (
      <Shell>
        <Notice tone="error" title="Sessão do Studio não encontrada">
          Abra o Studio pelo atalho <b>Iniciar-Studio</b> (ou <code>npm start</code>). Ele abre esta página já com o acesso
          liberado. Por segurança, o endereço muda a cada vez que o Studio é iniciado.
        </Notice>
      </Shell>
    );
  }

  return (
    <Shell status={status}>
      {fatal && <Notice tone="error" title="Problema com o Studio">{fatal}</Notice>}
      {status && !status.adb.found && <AdbMissing onRecheck={async () => { await call('POST', '/api/adb/recheck', {}); await refreshStatus(); }} />}
      {status?.adb.found && view.kind === 'connect' && (
        <ConnectWizard status={status} message={view.message} onConnected={onConnected} onOpen={loadInventory} />
      )}
      {view.kind === 'waiting' && (
        <section className="card center" aria-live="polite">
          <div className="spinner" aria-hidden />
          <h2>Aceite a conexão na TV</h2>
          <p>
            Na tela da TV deve aparecer <b>"Permitir depuração?"</b>. Marque <b>"Sempre permitir deste computador"</b> e
            escolha <b>Permitir</b> com o controle remoto.
          </p>
          <button className="ghost" onClick={() => setView({ kind: 'connect' })}>Cancelar</button>
        </section>
      )}
      {view.kind === 'loading' && (
        <section className="card center" aria-live="polite">
          <div className="spinner" aria-hidden />
          <h2>Lendo a sua TV…</h2>
          <p>Só leitura: nada é alterado. Pode levar até um minuto em TVs mais lentas.</p>
        </section>
      )}
      {view.kind === 'tv' && (
        <MyTv
          serial={view.serial}
          inventory={view.inventory}
          dataDir={status?.dataDir ?? ''}
          onRefresh={() => loadInventory(view.serial)}
          onDisconnect={() => onDisconnect(view.serial)}
        />
      )}
    </Shell>
  );
}

function Shell({ status, children }: { status?: StudioStatus | null; children: React.ReactNode }) {
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>▭</span> TV Smart Adaptative <span className="muted">Studio</span>
        </div>
        {status && (
          <div className="pills">
            {status.mode === 'fake' && <span className="pill warn">Modo simulado</span>}
            <span className={`pill ${status.adb.found ? 'ok' : 'bad'}`}>
              {status.adb.found ? `adb ${status.adb.version ?? ''}`.trim() : 'adb não encontrado'}
            </span>
          </div>
        )}
      </header>
      <main>{children}</main>
      <footer className="muted small">Fase 1 · somente leitura — nada é alterado na sua TV.</footer>
    </div>
  );
}

import { useCallback, useMemo, useState } from 'react';
import hints from '../../../../shared/catalog/connection-hints.json';
import { parseAddress } from '../address.ts';
import { ApiError, call } from '../api.ts';
import type { StudioStatus } from '../types.ts';
import { NearbyTvs } from './NearbyTvs.tsx';
import { Notice } from './Notice.tsx';

interface Props {
  status: StudioStatus;
  message?: string | undefined;
  onConnected: (serial: string) => void;
  onOpen: (serial: string) => void;
}

export function ConnectWizard({ status, message, onConnected, onOpen }: Props) {
  const [tab, setTab] = useState<'ip' | 'pair'>('ip');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pairAddress, setPairAddress] = useState('');
  const [pairCode, setPairCode] = useState('');

  const [listedHosts, setListedHosts] = useState<string[]>([]);
  const onHosts = useCallback((hosts: string[]) => setListedHosts(hosts), []);
  const connected = useMemo(
    () => new Map(status.devices.filter((d) => d.state === 'device').map((d) => [d.serial.split(':')[0]!, d.serial])),
    [status.devices],
  );
  // TVs conectadas que não aparecem na lista da rede (ex.: conectadas por outro caminho)
  const ready = status.devices.filter((d) => d.state === 'device' && !listedHosts.includes(d.serial.split(':')[0]!));

  async function connect(e?: React.FormEvent) {
    e?.preventDefault();
    const parsed = parseAddress(address);
    if ('error' in parsed) return setError(parsed.error);
    await connectTo(parsed.host, parsed.port ?? 5555);
  }

  async function connectTo(host: string, port: number) {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const r = await call<{ serial: string }>('POST', '/api/connect', { host, port });
      onConnected(r.serial);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao conectar.');
    } finally {
      setBusy(false);
    }
  }

  async function pair(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const parsed = parseAddress(pairAddress);
    if ('error' in parsed) return setError(parsed.error);
    if (!parsed.port) return setError('Informe também a porta do pareamento, ex.: 192.168.0.25:37123');
    const code = pairCode.replace(/\D/g, '');
    if (code.length !== 6) return setError('O código de pareamento tem 6 dígitos.');
    setBusy(true);
    try {
      await call('POST', '/api/pair', { host: parsed.host, port: parsed.port, code });
      setInfo('Pareado! Agora conecte usando o IP e a porta que aparecem na tela "Depuração por Wi-Fi" da TV.');
      setAddress(parsed.host + ':');
      setTab('ip');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha no pareamento.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      {message && <Notice tone="warn" title="Atenção">{message}</Notice>}
      {info && <Notice tone="ok" title="Tudo certo">{info}</Notice>}
      <NearbyTvs busy={busy} connected={connected} onConnect={(h, p) => void connectTo(h, p)} onOpen={onOpen} onHosts={onHosts} />
    <div className="grid">
      <section className="card">
        <h2>Conectar à TV</h2>
        <p className="muted">Não achou a sua TV na lista? Digite o IP. Funciona com Android TV e Google TV de qualquer marca.</p>

        {ready.length > 0 && (
          <div className="already">
            <h3>TV já conectada</h3>
            {ready.map((d) => (
              <button key={d.serial} className="secondary" onClick={() => onOpen(d.serial)}>
                Abrir {d.model ?? d.serial}
              </button>
            ))}
          </div>
        )}

        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'ip'} className={tab === 'ip' ? 'active' : ''} onClick={() => setTab('ip')}>
            Pelo IP (mais comum)
          </button>
          <button role="tab" aria-selected={tab === 'pair'} className={tab === 'pair' ? 'active' : ''} onClick={() => setTab('pair')}>
            Pareamento por código
          </button>
        </div>

        {tab === 'ip' ? (
          <form onSubmit={connect} className="form">
            <label htmlFor="tv-address">Endereço IP da TV</label>
            <input
              id="tv-address"
              inputMode="decimal"
              autoComplete="off"
              placeholder="ex.: 192.168.0.25"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <small className="muted">Se a TV mostrar uma porta (ex.: 192.168.0.25:5555), pode digitar junto.</small>
            <button type="submit" disabled={busy}>{busy ? 'Conectando…' : 'Conectar'}</button>
          </form>
        ) : (
          <form onSubmit={pair} className="form">
            <label htmlFor="pair-address">IP e porta do pareamento</label>
            <input id="pair-address" autoComplete="off" placeholder="ex.: 192.168.0.25:37123" value={pairAddress} onChange={(e) => setPairAddress(e.target.value)} />
            <label htmlFor="pair-code">Código de 6 dígitos</label>
            <input id="pair-code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="123456" value={pairCode} onChange={(e) => setPairCode(e.target.value)} />
            <button type="submit" disabled={busy}>{busy ? 'Pareando…' : 'Parear'}</button>
          </form>
        )}
        {error && <Notice tone="error" title="Não deu certo">{error}</Notice>}

        {status.fakeNetwork && (
          <details className="fake">
            <summary>Modo simulado — TVs de mentira para testar</summary>
            <ul>
              {status.fakeNetwork.map((f) => (
                <li key={f.host}>
                  <button className="link" onClick={() => setAddress(f.host)}>{f.host}</button> — {f.scenario}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="card steps" id="preparar-tv">
        <h2>Primeira vez? Prepare a TV</h2>
        <Step n={1} title="Ative o modo desenvolvedor" items={hints.generic.developerMode} />
        <Step n={2} title="Ative a depuração" items={hints.generic.debugging} />
        <Step n={3} title="Descubra o IP da TV" items={hints.generic.findIp} />
        <Step n={4} title="Aceite na TV" items={hints.generic.accept} />
        {tab === 'pair' && <Step n={5} title="Pareamento por código" items={hints.generic.pairing} />}
        <details>
          <summary>Dicas por marca</summary>
          <ul>
            {hints.brands.map((b) => (
              <li key={b.name}>
                <b>{b.name}:</b> {b.tip}
              </li>
            ))}
          </ul>
        </details>
        <Notice tone="info" title="É seguro?">
          Sim. Nesta fase o Studio só <b>lê</b> informações. Você pode desligar a depuração na TV quando quiser.
        </Notice>
      </section>
    </div>
    </div>
  );
}

function Step({ n, title, items }: { n: number; title: string; items: string[] }) {
  return (
    <div className="step">
      <span className="num">{n}</span>
      <div>
        <h3>{title}</h3>
        <ul>
          {items.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { ApiError, call } from '../api.ts';
import type { DiscoveredTv, DiscoveryResult } from '../types.ts';

interface Props {
  busy: boolean;
  /** host da TV → serial do adb, para TVs já conectadas e autorizadas. */
  connected: Map<string, string>;
  onConnect: (host: string, port: number) => void;
  onOpen: (serial: string) => void;
  onHosts?: (hosts: string[]) => void;
}

export function NearbyTvs({ busy, connected, onConnect, onOpen, onHosts }: Props) {
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async () => {
    setSearching(true);
    setError(null);
    try {
      const r = await call<DiscoveryResult>('POST', '/api/discover', {});
      setResult(r);
      onHosts?.(r.tvs.map((t) => t.host));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível procurar.');
    } finally {
      setSearching(false);
    }
  }, [onHosts]);

  useEffect(() => {
    void search();
  }, [search]);

  const tvs = result?.tvs ?? [];

  return (
    <section className="card" aria-labelledby="nearby-title">
      <div className="row-between">
        <div>
          <h2 id="nearby-title">TVs encontradas na sua rede</h2>
          <p className="muted small">
            {searching
              ? 'Procurando… (leva poucos segundos)'
              : result
                ? describeNetworks(result)
                : ''}
          </p>
        </div>
        <button className="secondary" onClick={() => void search()} disabled={searching}>
          {searching ? 'Procurando…' : 'Procurar de novo'}
        </button>
      </div>

      {error && <p className="error-text" role="alert">{error}</p>}

      {searching && !result && (
        <div className="tv-list">
          {[0, 1, 2].map((i) => (
            <div key={i} className="tv-item skeleton" aria-hidden />
          ))}
        </div>
      )}

      {result && tvs.length === 0 && !searching && (
        <p className="muted">
          Nenhuma TV encontrada. Confira se a TV está ligada e no <b>mesmo Wi-Fi</b> que o computador (redes de
          convidados costumam isolar os aparelhos). Você também pode digitar o IP logo abaixo.
        </p>
      )}

      {tvs.length > 0 && (
        <ul className="tv-list" aria-label="TVs encontradas">
          {tvs.map((tv) => (
            <TvItem key={tv.host} tv={tv} busy={busy} serial={connected.get(tv.host)} onConnect={onConnect} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Mostra só as redes onde há TV; as outras (virtuais, VPN…) só entram na contagem. */
export function describeNetworks(result: DiscoveryResult): string {
  if (!result.networks.length) return 'Este computador não parece estar numa rede de casa (Wi-Fi ou cabo).';
  const n = result.tvs.length;
  if (!n) return `Nenhum aparelho encontrado (${result.networks.length} ${result.networks.length === 1 ? 'rede verificada' : 'redes verificadas'}).`;
  const withTv = result.networks.filter((net) => result.tvs.some((t) => t.host.startsWith(net.prefix24 + '.')));
  return `${n} ${n === 1 ? 'aparelho' : 'aparelhos'} na rede ${withTv.map((net) => `${net.prefix24}.x`).join(', ')}`;
}

interface ItemProps {
  tv: DiscoveredTv;
  busy: boolean;
  serial: string | undefined;
  onConnect: Props['onConnect'];
  onOpen: Props['onOpen'];
}

function TvItem({ tv, busy, serial, onConnect, onOpen }: ItemProps) {
  const title = tv.name ?? tv.model ?? 'Aparelho sem nome';
  if (serial) {
    return (
      <li className="tv-item ready">
        <div className="tv-head">
          <span className="tv-icon" aria-hidden>▭</span>
          <div className="tv-info">
            <b title={title}>{title}</b>
            <span className="muted small">{tv.host}{tv.name && tv.model ? ` · ${tv.model}` : ''}</span>
          </div>
        </div>
        <div className="tv-foot">
          <span className="pill ok">Conectada</span>
          <button onClick={() => onOpen(serial)} aria-label={`Abrir ${title}`}>Abrir</button>
        </div>
      </li>
    );
  }
  return (
    <li className={`tv-item ${tv.debuggingEnabled ? 'ready' : 'off'}`}>
      <div className="tv-head">
        <span className="tv-icon" aria-hidden>▭</span>
        <div className="tv-info">
          <b title={title}>{title}</b>
          <span className="muted small">
            {tv.host}
            {tv.name && tv.model ? ` · ${tv.model}` : ''}
          </span>
        </div>
      </div>
      <div className="tv-foot">
        <span className={`pill ${tv.debuggingEnabled ? 'ok' : 'warn'}`}>
          {tv.debuggingEnabled ? 'Pronta para conectar' : 'Depuração desligada'}
        </span>
        {tv.debuggingEnabled && tv.adbPort ? (
          <button disabled={busy} onClick={() => onConnect(tv.host, tv.adbPort!)} aria-label={`Conectar a ${title}`}>
            Conectar
          </button>
        ) : (
          <a className="small" href="#preparar-tv">Como ligar</a>
        )}
      </div>
    </li>
  );
}

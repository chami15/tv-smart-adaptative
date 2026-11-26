import { useCallback, useEffect, useState } from 'react';
import { ApiError, call } from '../api.ts';
import type { DiscoveredTv, DiscoveryResult } from '../types.ts';

interface Props {
  busy: boolean;
  onConnect: (host: string, port: number) => void;
}

export function NearbyTvs({ busy, onConnect }: Props) {
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async () => {
    setSearching(true);
    setError(null);
    try {
      setResult(await call<DiscoveryResult>('POST', '/api/discover', {}));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível procurar.');
    } finally {
      setSearching(false);
    }
  }, []);

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
                ? result.networks.length
                  ? `Rede ${result.networks.map((n) => `${n.prefix24}.x`).join(', ')} · ${tvs.length} ${tvs.length === 1 ? 'aparelho' : 'aparelhos'}`
                  : 'Este computador não parece estar numa rede de casa (Wi-Fi ou cabo).'
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
            <TvItem key={tv.host} tv={tv} busy={busy} onConnect={onConnect} />
          ))}
        </ul>
      )}
    </section>
  );
}

function TvItem({ tv, busy, onConnect }: { tv: DiscoveredTv; busy: boolean; onConnect: Props['onConnect'] }) {
  const title = tv.name ?? tv.model ?? 'Aparelho sem nome';
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

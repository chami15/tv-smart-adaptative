import { useEffect, useState } from 'react';
import { ApiError, call } from '../api.ts';
import type { PlanResponse, SnapshotSummary, StudioStatus } from '../types.ts';
import { Notice } from './Notice.tsx';
import { PlanFlow } from './PlanFlow.tsx';

interface Props {
  serial: string;
  deviceId: string;
  writes: StudioStatus['writes'];
  onChanged: () => void;
}

export function Backups({ serial, deviceId, writes, onChanged }: Props) {
  const [list, setList] = useState<SnapshotSummary[] | null>(null);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyDir, setBusyDir] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    call<SnapshotSummary[]>('GET', `/api/snapshots?deviceId=${deviceId}`)
      .then(setList)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Falha ao listar.'));
  }, [deviceId, reload]);

  async function restore(dir: string) {
    setBusyDir(dir);
    setError(null);
    try {
      setPlan(await call<PlanResponse>('POST', '/api/restore/plan', { serial, snapshotDir: dir }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao preparar a restauração.');
    } finally {
      setBusyDir(null);
    }
  }

  if (plan) {
    return (
      <PlanFlow
        initial={plan}
        serial={serial}
        writes={writes}
        onChanged={onChanged}
        onClose={() => {
          setPlan(null);
          setReload((n) => n + 1);
        }}
      />
    );
  }

  return (
    <section className="card">
      <h2>Backups desta TV</h2>
      <p className="muted">
        Cada backup guarda quais apps estavam ativos ou desativados. "Restaurar" mostra o que vai mudar antes de aplicar.
      </p>
      {error && <Notice tone="error" title="Não deu certo">{error}</Notice>}
      {!list ? (
        <p className="muted">Carregando…</p>
      ) : list.length === 0 ? (
        <p className="muted">Nenhum backup ainda. Use "Salvar backup agora" no topo.</p>
      ) : (
        <ul className="backup-list">
          {list.map((b) => (
            <li key={b.dir}>
              <div>
                <b>{new Date(b.createdAt).toLocaleString('pt-BR')}</b>
                <span className="muted small">{b.reason === 'manual' ? 'Backup manual' : 'Automático, antes de uma mudança'}</span>
                <span className="muted mono small" title={b.dir}>{b.dir}</span>
              </div>
              <button className="secondary" disabled={busyDir !== null} onClick={() => void restore(b.dir)}>
                {busyDir === b.dir ? 'Comparando…' : 'Restaurar'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

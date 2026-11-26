// Revisar → aplicar → resultado. Usado pela limpeza e pela restauração de backup.
import { useState } from 'react';
import { ApiError, call } from '../api.ts';
import { formatMemory } from '../format.ts';
import type { ExecutionResult, PlanResponse, StudioStatus } from '../types.ts';
import { Notice } from './Notice.tsx';

interface Props {
  initial: PlanResponse;
  serial: string;
  writes: StudioStatus['writes'];
  onChanged: () => void;
  onClose: () => void;
}

type Stage = { kind: 'review'; data: PlanResponse } | { kind: 'applying'; data: PlanResponse } | { kind: 'result'; result: ExecutionResult };

export function PlanFlow({ initial, serial, writes, onChanged, onClose }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: 'review', data: initial });
  const [error, setError] = useState<string | null>(null);
  const allowed = writes?.allowed ?? false;

  async function apply(data: PlanResponse) {
    if (!data.plan) return;
    setError(null);
    setStage({ kind: 'applying', data });
    try {
      const result = await call<ExecutionResult>('POST', '/api/plan/execute', { planId: data.plan.id, hash: data.plan.hash });
      setStage({ kind: 'result', result });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao aplicar.');
      setStage({ kind: 'review', data });
    }
  }

  async function undoAll(snapshotDir: string) {
    setError(null);
    try {
      const data = await call<PlanResponse>('POST', '/api/restore/plan', { serial, snapshotDir });
      setStage({ kind: 'review', data: { ...data, plan: data.plan ? { ...data.plan, title: 'Desfazer: voltar como estava antes' } : null } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao preparar o desfazer.');
    }
  }

  if (stage.kind === 'applying') {
    return (
      <section className="card center" aria-live="polite">
        <div className="spinner" aria-hidden />
        <h2>Aplicando… não desligue a TV</h2>
        <p className="muted">Um passo de cada vez, conferindo cada um. Se algo der errado, o Studio desfaz sozinho.</p>
      </section>
    );
  }

  if (stage.kind === 'result') {
    const r = stage.result;
    const freed = r.memoryAfterKb != null && r.memoryBeforeKb != null ? r.memoryAfterKb - r.memoryBeforeKb : null;
    return (
      <section className="card" aria-live="polite">
        {r.status === 'completed' && (
          <>
            <h2>Pronto!</h2>
            <p>{r.message}</p>
            {freed !== null && (
              <div className="stats compact">
                <div><span className="muted small">Memória livre antes</span><p className="big">{formatMemory(r.memoryBeforeKb!)}</p></div>
                <div><span className="muted small">Memória livre agora</span><p className="big ok-text">{formatMemory(r.memoryAfterKb!)}</p></div>
                <div><span className="muted small">Diferença</span><p className="big">{freed >= 0 ? '+' : ''}{formatMemory(freed)}</p></div>
              </div>
            )}
          </>
        )}
        {r.status === 'rolled-back' && (
          <Notice tone="warn" title="Não deu certo — e nada ficou alterado">{r.message}</Notice>
        )}
        {r.status === 'interrupted' && <Notice tone="warn" title="A conexão caiu no meio">{r.message}</Notice>}
        {r.status === 'rollback-failed' && <Notice tone="error" title="Atenção: use Restaurar TV">{r.message}</Notice>}
        {r.status === 'refused' && (
          <Notice tone="warn" title="Nada foi alterado">
            {r.message}
            {r.problems?.length ? <ul>{r.problems.map((p) => <li key={p.pkg + p.reason}>{p.pkg}: {p.reason}</li>)}</ul> : null}
          </Notice>
        )}
        {r.steps.length > 0 && (
          <details>
            <summary>Detalhes ({r.steps.length} passos)</summary>
            <ul className="steps-list">
              {r.steps.map((s) => (
                <li key={s.pkg + s.kind}>
                  <span className={`pill ${STEP_TONE[s.status] ?? ''}`}>{STEP_LABEL[s.status] ?? s.status}</span> {s.kind === 'disable' ? 'Desativar' : 'Reativar'} {s.label}
                  {s.error ? <span className="muted small"> — {s.error}</span> : null}
                </li>
              ))}
            </ul>
          </details>
        )}
        {error && <Notice tone="error" title="Não deu certo">{error}</Notice>}
        <div className="actions-row">
          {r.status === 'completed' && r.snapshotDir && (
            <button className="secondary" onClick={() => void undoAll(r.snapshotDir!)}>Desfazer tudo</button>
          )}
          <button onClick={onClose}>Concluir</button>
        </div>
      </section>
    );
  }

  const { plan, rejected, error: planError } = stage.data;
  const freedKb = plan?.actions.reduce((n, a) => n + (a.kind === 'disable' ? a.estimatedKb ?? 0 : 0), 0) ?? 0;
  return (
    <section className="card">
      <h2>Revise antes de aplicar</h2>
      {planError && <Notice tone="error" title="Não é possível">{planError}</Notice>}
      {!plan && !planError && (
        <Notice tone="info" title="Nada a fazer">
          {rejected.length ? 'Nenhum dos itens pode ser alterado (veja abaixo).' : 'A TV já está exatamente assim.'}
        </Notice>
      )}
      {plan && (
        <>
          <p className="big-title">{plan.title}</p>
          {freedKb > 0 && <p className="muted">Pode liberar cerca de <b>{formatMemory(freedKb)}</b> de memória.</p>}
          <ol className="plan-list">
            {plan.actions.map((a) => (
              <li key={a.pkg}>
                <b>{a.kind === 'disable' ? 'Desativar' : 'Reativar'}</b> {a.label} <span className="muted mono small">{a.pkg}</span>
                {a.kind === 'disable' && a.effect && <div className={`small ${a.level === 'caution' ? 'warn-text' : 'muted'}`}>{a.effect}</div>}
              </li>
            ))}
          </ol>
          <Notice tone="info" title="Como o Studio protege a sua TV">
            Antes de aplicar, salva um backup. Faz um passo de cada vez e confere cada um. Se algo der errado, desfaz
            sozinho. Tudo pode ser revertido depois em "Backups".
          </Notice>
        </>
      )}
      {rejected.length > 0 && (
        <details open={!plan}>
          <summary>Ficaram de fora ({rejected.length})</summary>
          <ul>{rejected.map((r) => <li key={r.pkg + r.reason}><span className="mono small">{r.pkg}</span> — {r.reason}</li>)}</ul>
        </details>
      )}
      {plan && !allowed && <Notice tone="warn" title="Aplicar está bloqueado nesta TV">{writes?.reason}</Notice>}
      {error && <Notice tone="error" title="Não deu certo">{error}</Notice>}
      <div className="actions-row">
        <button className="ghost" onClick={onClose}>Voltar</button>
        {plan && <button onClick={() => void apply(stage.data)} disabled={!allowed}>Aplicar</button>}
      </div>
    </section>
  );
}

const STEP_LABEL: Record<string, string> = {
  done: 'feito', undone: 'desfeito', failed: 'falhou', pending: 'não executado', started: 'em andamento',
  'undo-failed': 'não desfeito', 'undo-skipped': 'mantido',
};
const STEP_TONE: Record<string, string> = { done: 'ok', undone: 'warn', failed: 'bad', 'undo-failed': 'bad' };

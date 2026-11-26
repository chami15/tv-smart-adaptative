import { useEffect, useMemo, useState } from 'react';
import { ApiError, call } from '../api.ts';
import { formatMemory } from '../format.ts';
import type { CleanupItem, PlanResponse, StudioStatus } from '../types.ts';
import { Notice } from './Notice.tsx';
import { PlanFlow } from './PlanFlow.tsx';

interface Props {
  serial: string;
  writes: StudioStatus['writes'];
  onChanged: () => void;
}

export function Cleanup({ serial, writes, onChanged }: Props) {
  const [items, setItems] = useState<CleanupItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setItems(null);
    call<{ items: CleanupItem[] }>('POST', '/api/cleanup', { serial })
      .then((r) => alive && setItems(r.items))
      .catch((err) => alive && setError(err instanceof ApiError ? err.message : 'Falha ao carregar.'));
    return () => {
      alive = false;
    };
  }, [serial, reload]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (items ?? [])
      .filter((i) => !q || i.label.toLowerCase().includes(q) || i.pkg.toLowerCase().includes(q))
      .sort((a, b) => (b.memoryKb ?? 0) - (a.memoryKb ?? 0) || a.label.localeCompare(b.label));
    return {
      safe: list.filter((i) => i.enabled && i.level === 'safe'),
      caution: list.filter((i) => i.enabled && i.level === 'caution'),
      disabled: list.filter((i) => !i.enabled),
      protected: list.filter((i) => i.enabled && i.level === 'protected'),
    };
  }, [items, query]);

  const byPkg = useMemo(() => new Map((items ?? []).map((i) => [i.pkg, i])), [items]);
  const selectedItems = [...selected].map((p) => byPkg.get(p)).filter((i): i is CleanupItem => !!i);
  const freedKb = selectedItems.reduce((n, i) => n + (i.enabled ? i.memoryKb ?? 0 : 0), 0);

  const toggle = (pkg: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(pkg) ? n.delete(pkg) : n.add(pkg);
      return n;
    });

  async function review() {
    setBusy(true);
    setError(null);
    try {
      const disable = selectedItems.filter((i) => i.enabled).map((i) => i.pkg);
      const enable = selectedItems.filter((i) => !i.enabled).map((i) => i.pkg);
      setPlan(await call<PlanResponse>('POST', '/api/plan', { serial, disable, enable }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao montar o plano.');
    } finally {
      setBusy(false);
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
          setSelected(new Set());
          setReload((n) => n + 1);
        }}
      />
    );
  }

  if (error) return <Notice tone="error" title="Não foi possível abrir a limpeza">{error}</Notice>;
  if (!items) {
    return (
      <section className="card center">
        <div className="spinner" aria-hidden />
        <p>Classificando os apps da TV…</p>
      </section>
    );
  }

  return (
    <div className="stack">
      {!writes?.allowed && (
        <Notice tone="info" title="Modo prévia">
          {writes?.reason}
        </Notice>
      )}
      <section className="card">
        <div className="row-between">
          <div>
            <h2>Limpar memória</h2>
            <p className="muted">
              Desativar um app pré-instalado é <b>reversível</b>: ele some e para de ocupar memória até você reativar.
              Nada é desinstalado.
            </p>
          </div>
          <input className="search" aria-label="Buscar na limpeza" placeholder="Buscar app…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </section>

      <Group
        title="🟢 Recomendados para desativar"
        hint="Seguros: não afetam o funcionamento da TV."
        items={groups.safe}
        selected={selected}
        onToggle={toggle}
        action={
          groups.safe.length > 0 && (
            <button className="link" onClick={() => setSelected((s) => new Set([...s, ...groups.safe.map((i) => i.pkg)]))}>
              Selecionar todos
            </button>
          )
        }
      />
      <Group title="🟡 Com cuidado" hint="Funcionam, mas você perde o recurso descrito em cada um." items={groups.caution} selected={selected} onToggle={toggle} />
      {groups.disabled.length > 0 && (
        <Group title="Já desativados" hint="Marque para reativar." items={groups.disabled} selected={selected} onToggle={toggle} reenable />
      )}
      <section className="card">
        <details>
          <summary>🔴 Intocáveis ({groups.protected.length}) — o Studio nunca desativa estes</summary>
          <ul className="locked-list">
            {groups.protected.map((i) => (
              <li key={i.pkg}>
                <span aria-hidden>🔒</span> <b>{i.label}</b> <span className="muted mono small">{i.pkg}</span>
                {i.description && <div className="small muted">{i.description}</div>}
              </li>
            ))}
          </ul>
        </details>
      </section>

      <div className="selection-bar" role="region" aria-label="Seleção">
        <span>
          <b>{selected.size}</b> {selected.size === 1 ? 'selecionado' : 'selecionados'}
          {freedKb > 0 && <> · pode liberar ~<b>{formatMemory(freedKb)}</b></>}
        </span>
        <span className="actions-row">
          {selected.size > 0 && <button className="ghost" onClick={() => setSelected(new Set())}>Limpar seleção</button>}
          <button disabled={selected.size === 0 || busy} onClick={() => void review()}>
            {busy ? 'Montando…' : 'Revisar plano'}
          </button>
        </span>
      </div>
    </div>
  );
}

function Group(props: {
  title: string;
  hint: string;
  items: CleanupItem[];
  selected: Set<string>;
  onToggle: (pkg: string) => void;
  action?: React.ReactNode;
  reenable?: boolean;
}) {
  return (
    <section className="card">
      <div className="row-between">
        <div>
          <h3>
            {props.title} <span className="muted small">({props.items.length})</span>
          </h3>
          <p className="muted small">{props.hint}</p>
        </div>
        {props.action}
      </div>
      {props.items.length === 0 ? (
        <p className="muted small">Nada aqui.</p>
      ) : (
        <ul className="pick-list">
          {props.items.map((i) => (
            <li key={i.pkg}>
              <label>
                <input type="checkbox" checked={props.selected.has(i.pkg)} onChange={() => props.onToggle(i.pkg)} aria-label={`${props.reenable ? 'Reativar' : 'Desativar'} ${i.label}`} />
                <span className="pick-main">
                  <b>{i.label}</b>
                  <span className="muted mono small">{i.pkg}</span>
                  {i.effect && <span className={`small ${i.level === 'caution' ? 'warn-text' : 'muted'}`}>{i.effect}</span>}
                </span>
                <span className="pick-mem small">{i.memoryKb ? formatMemory(i.memoryKb) : ''}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

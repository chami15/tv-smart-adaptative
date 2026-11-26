import { useMemo, useState } from 'react';
import { ApiError, call } from '../api.ts';
import { formatMemory, RAM_LABEL, RESOLUTION_LABEL } from '../format.ts';
import type { DeviceInventory } from '../types.ts';
import { Notice } from './Notice.tsx';

type Filter = 'all' | 'system' | 'user' | 'disabled';

interface Props {
  serial: string;
  inventory: DeviceInventory;
  dataDir: string;
  onRefresh: () => void;
  onDisconnect: () => void;
}

export function MyTv({ serial, inventory: inv, onRefresh, onDisconnect }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [snap, setSnap] = useState<{ busy: boolean; dir?: string; error?: string }>({ busy: false });

  const counts = useMemo(
    () => ({
      all: inv.packages.length,
      system: inv.packages.filter((p) => p.system).length,
      user: inv.packages.filter((p) => !p.system).length,
      disabled: inv.packages.filter((p) => !p.enabled).length,
    }),
    [inv],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inv.packages.filter((p) => {
      if (filter === 'system' && !p.system) return false;
      if (filter === 'user' && p.system) return false;
      if (filter === 'disabled' && p.enabled) return false;
      return !q || p.name.toLowerCase().includes(q);
    });
  }, [inv, filter, query]);

  const used = inv.memory.totalKb && inv.memory.availableKb !== null ? inv.memory.totalKb - inv.memory.availableKb : null;
  const usedPct = used !== null && inv.memory.totalKb ? Math.round((used / inv.memory.totalKb) * 100) : null;
  const memByName = new Map(inv.processes.map((p) => [p.name, p.kb]));

  async function saveSnapshot() {
    setSnap({ busy: true });
    try {
      const r = await call<{ dir: string }>('POST', '/api/snapshot', { serial });
      setSnap({ busy: false, dir: r.dir });
    } catch (err) {
      setSnap({ busy: false, error: err instanceof ApiError ? err.message : 'Falha ao salvar.' });
    }
  }

  return (
    <div className="stack">
      <section className="card tv-card">
        <div>
          <p className="muted small">Minha TV</p>
          <h2 data-testid="tv-title">
            {inv.device.brand} {inv.device.model}
          </h2>
          <p>
            <span className={`pill ${inv.device.supported ? 'ok' : 'warn'}`}>{inv.device.platformLabel}</span> Android{' '}
            {inv.device.androidVersion}
            {inv.device.apiLevel ? ` (API ${inv.device.apiLevel})` : ''}
            {inv.device.hasGoogleServices ? ' · serviços Google' : ' · sem serviços Google'}
          </p>
        </div>
        <div className="actions">
          <button onClick={saveSnapshot} disabled={snap.busy}>{snap.busy ? 'Salvando…' : 'Salvar backup agora'}</button>
          <button className="secondary" onClick={onRefresh}>Ler de novo</button>
          <button className="ghost" onClick={onDisconnect}>Desconectar</button>
        </div>
      </section>

      {!inv.device.supported && <Notice tone="warn" title="Esta TV ainda não é suportada para personalização">{inv.device.supportReason}</Notice>}
      {inv.warnings.length > 0 && (
        <Notice tone="warn" title="Algumas informações não puderam ser lidas">
          <ul>{inv.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </Notice>
      )}
      {snap.dir && (
        <Notice tone="ok" title="Backup salvo no seu computador">
          <code className="path">{snap.dir}</code>{' '}
          <button className="link" onClick={() => void navigator.clipboard?.writeText(snap.dir!)}>copiar caminho</button>
        </Notice>
      )}
      {snap.error && <Notice tone="error" title="Não foi possível salvar o backup">{snap.error}</Notice>}

      <div className="grid three">
        <section className="card">
          <h3>Memória</h3>
          <p className="big">{formatMemory(inv.memory.totalKb)}</p>
          <p className="muted">{RAM_LABEL[inv.memory.ramClass]}</p>
          {usedPct !== null && (
            <>
              <div className="bar" role="meter" aria-valuenow={usedPct} aria-valuemin={0} aria-valuemax={100} aria-label="Memória em uso">
                <span style={{ width: `${usedPct}%` }} />
              </div>
              <p className="small">
                {usedPct}% em uso · {formatMemory(inv.memory.availableKb)} livres
              </p>
            </>
          )}
        </section>
        <section className="card">
          <h3>Tela</h3>
          <p className="big">{RESOLUTION_LABEL[inv.display.resolutionClass] ?? inv.display.resolutionClass}</p>
          <p className="muted">
            {inv.display.width && inv.display.height ? `${inv.display.width} × ${inv.display.height}` : 'resolução desconhecida'}
            {inv.display.density ? ` · densidade ${inv.display.density}` : ''}
          </p>
        </section>
        <section className="card">
          <h3>Tela inicial atual</h3>
          <p className="mono">{inv.currentHome?.package ?? 'desconhecida'}</p>
          {inv.currentHome && memByName.has(inv.currentHome.package) && (
            <p className="muted">usando {formatMemory(memByName.get(inv.currentHome.package)!)} de memória</p>
          )}
        </section>
      </div>

      <section className="card">
        <h3>O que dá para fazer nesta TV</h3>
        <ul className="caps">
          {inv.capabilities.map((c) => (
            <li key={c.id} className={c.status}>
              <span className="icon" aria-hidden>{c.status === 'available' ? '✔' : c.status === 'planned' ? '◷' : '✖'}</span>
              <div>
                <b>{c.label}</b>{' '}
                <span className="muted small">
                  {c.status === 'available' ? 'disponível' : c.status === 'planned' ? `em breve (fase ${c.phase})` : 'não suportado'}
                </span>
                <div className="small muted">{c.detail}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {inv.processes.length > 0 && (
        <section className="card">
          <h3>Quem mais usa memória agora</h3>
          <ol className="procs">
            {inv.processes.slice(0, 8).map((p) => (
              <li key={p.name}>
                <span className="mono">{p.name}</span>
                <span>{formatMemory(p.kb)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="card">
        <h3>Apps instalados</h3>
        <div className="toolbar">
          {(['all', 'system', 'user', 'disabled'] as const).map((f) => (
            <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)} aria-pressed={filter === f}>
              {{ all: 'Todos', system: 'Do sistema', user: 'Instalados por você', disabled: 'Desativados' }[f]} ({counts[f]})
            </button>
          ))}
          <input aria-label="Buscar app" placeholder="Buscar app…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <table className="apps">
          <thead>
            <tr>
              <th>App (pacote)</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Memória</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.name}>
                <td className="mono">{p.name}</td>
                <td>{p.system ? 'sistema' : 'usuário'}</td>
                <td>{p.enabled ? 'ativo' : <span className="pill warn">desativado</span>}</td>
                <td>{memByName.has(p.name) ? formatMemory(memByName.get(p.name)!) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="muted">Nenhum app encontrado.</p>}
        <p className="muted small">A classificação 🟢 seguro / 🟡 cuidado / 🔴 intocável chega na Fase 3 (limpeza).</p>
      </section>
    </div>
  );
}

import { useState } from 'react';
import { Notice } from './Notice.tsx';

export function AdbMissing({ onRecheck }: { onRecheck: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <section className="card">
      <h2>Falta um programa do Google: o "adb"</h2>
      <p>O Studio conversa com a TV usando o <b>adb</b>, ferramenta oficial e gratuita do Android. Para instalar:</p>
      <ol>
        <li>
          Baixe o <b>SDK Platform-Tools para Windows</b> no site oficial:{' '}
          <a href="https://developer.android.com/tools/releases/platform-tools" target="_blank" rel="noreferrer">
            developer.android.com/tools/releases/platform-tools
          </a>
        </li>
        <li>Extraia o arquivo .zip. Vai aparecer uma pasta chamada <code>platform-tools</code>.</li>
        <li>
          Coloque essa pasta em <code>C:\platform-tools</code> ou dentro da sua pasta <code>Downloads</code>.
        </li>
        <li>Clique em "Verificar de novo".</li>
      </ol>
      <Notice tone="info" title="Por que não vem junto?">
        Assim você sempre usa a versão oficial e mais recente, direto do Google.
      </Notice>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onRecheck();
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Verificando…' : 'Verificar de novo'}
      </button>
    </section>
  );
}

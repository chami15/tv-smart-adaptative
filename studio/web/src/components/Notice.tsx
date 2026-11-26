export function Notice({ tone, title, children }: { tone: 'error' | 'info' | 'ok' | 'warn'; title: string; children?: React.ReactNode }) {
  return (
    <div className={`notice ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <strong>{title}</strong>
      {children && <div>{children}</div>}
    </div>
  );
}

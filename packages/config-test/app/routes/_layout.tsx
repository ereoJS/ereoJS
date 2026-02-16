export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>ServerFnConfig Test Dashboard</title>
        <style dangerouslySetInnerHTML={{ __html: `
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
            background: #0f172a;
            color: #e2e8f0;
            line-height: 1.5;
          }
          .container { max-width: 900px; margin: 0 auto; padding: 2rem 1rem; }
          h1 { font-size: 1.75rem; font-weight: 700; color: #f8fafc; margin-bottom: 0.25rem; }
          .subtitle { color: #94a3b8; font-size: 0.875rem; margin-bottom: 1.5rem; }
          .summary {
            display: flex; gap: 1rem; margin-bottom: 2rem;
            background: #1e293b; border-radius: 8px; padding: 1rem;
            border: 1px solid #334155;
          }
          .summary-item { text-align: center; flex: 1; }
          .summary-value { font-size: 2rem; font-weight: 700; }
          .summary-value.green { color: #22c55e; }
          .summary-value.red { color: #ef4444; }
          .summary-value.blue { color: #3b82f6; }
          .summary-label { font-size: 0.7rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; }
          .suite {
            background: #1e293b; border-radius: 8px; padding: 1.25rem;
            margin-bottom: 1rem; border: 1px solid #334155;
          }
          .suite-header {
            display: flex; justify-content: space-between; align-items: center;
            margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid #334155;
          }
          .suite-name { font-size: 1.1rem; font-weight: 600; color: #f1f5f9; }
          .suite-badge {
            font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.6rem;
            border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em;
          }
          .suite-badge.pass { background: #166534; color: #bbf7d0; }
          .suite-badge.fail { background: #991b1b; color: #fecaca; }
          .test {
            display: flex; align-items: flex-start; gap: 0.75rem;
            padding: 0.5rem 0; border-bottom: 1px solid #1e293b;
          }
          .test:last-child { border-bottom: none; }
          .test-icon { font-size: 1rem; flex-shrink: 0; margin-top: 0.1rem; }
          .test-icon.pass { color: #22c55e; }
          .test-icon.fail { color: #ef4444; }
          .test-name { font-size: 0.85rem; font-weight: 500; color: #cbd5e1; }
          .test-details {
            font-size: 0.75rem; color: #64748b; margin-top: 0.2rem;
            font-family: 'SF Mono', 'Fira Code', monospace;
            word-break: break-all;
          }
          .test-error {
            font-size: 0.75rem; color: #f87171; margin-top: 0.2rem;
            font-family: 'SF Mono', 'Fira Code', monospace;
          }
          .reload-form { margin-bottom: 1.5rem; }
          .btn {
            padding: 0.5rem 1rem; border: 1px solid #3b82f6; border-radius: 6px;
            background: transparent; color: #60a5fa; font-size: 0.8rem;
            font-weight: 600; cursor: pointer; transition: all 0.2s;
          }
          .btn:hover { background: #3b82f6; color: white; }
          .timestamp { color: #475569; font-size: 0.7rem; margin-top: 1rem; text-align: center; }
        `}} />
      </head>
      <body>
        <div className="container">
          {children}
        </div>
      </body>
    </html>
  );
}

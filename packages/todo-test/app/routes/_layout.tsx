export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Todo App — Ereo Server Blocks</title>
        <style dangerouslySetInnerHTML={{ __html: `
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            color: #1a1a1a;
            line-height: 1.5;
          }
          .container { max-width: 640px; margin: 0 auto; padding: 2rem 1rem; }
          h1 { font-size: 2rem; font-weight: 700; margin-bottom: 0.25rem; }
          .subtitle { color: #666; font-size: 0.875rem; margin-bottom: 1.5rem; }
          .stats {
            display: flex; gap: 1rem; margin-bottom: 1.5rem;
            background: white; border-radius: 8px; padding: 1rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          .stat { text-align: center; flex: 1; }
          .stat-value { font-size: 1.5rem; font-weight: 700; }
          .stat-label { font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
          .add-form {
            display: flex; gap: 0.5rem; margin-bottom: 1.5rem;
          }
          .add-form input[type="text"] {
            flex: 1; padding: 0.75rem 1rem; border: 2px solid #e0e0e0;
            border-radius: 8px; font-size: 1rem; outline: none;
            transition: border-color 0.2s;
          }
          .add-form input[type="text"]:focus { border-color: #3b82f6; }
          .btn {
            padding: 0.75rem 1.25rem; border: none; border-radius: 8px;
            font-size: 0.875rem; font-weight: 600; cursor: pointer;
            transition: background-color 0.2s, transform 0.1s;
          }
          .btn:active { transform: scale(0.97); }
          .btn-primary { background: #3b82f6; color: white; }
          .btn-primary:hover { background: #2563eb; }
          .btn-danger { background: #ef4444; color: white; padding: 0.5rem 0.75rem; font-size: 0.75rem; }
          .btn-danger:hover { background: #dc2626; }
          .todo-list { display: flex; flex-direction: column; gap: 0.5rem; }
          .todo-item {
            display: flex; align-items: center; gap: 0.75rem;
            background: white; border-radius: 8px; padding: 0.75rem 1rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            transition: box-shadow 0.2s;
          }
          .todo-item:hover { box-shadow: 0 2px 6px rgba(0,0,0,0.15); }
          .todo-item.completed { opacity: 0.6; }
          .todo-item.completed .todo-title { text-decoration: line-through; color: #888; }
          .todo-title { flex: 1; font-size: 0.95rem; }
          .todo-date { font-size: 0.7rem; color: #aaa; }
          .toggle-btn {
            width: 24px; height: 24px; border-radius: 50%;
            border: 2px solid #d1d5db; background: transparent;
            cursor: pointer; display: flex; align-items: center;
            justify-content: center; font-size: 0.75rem;
            transition: all 0.2s; flex-shrink: 0;
          }
          .toggle-btn.checked { background: #22c55e; border-color: #22c55e; color: white; }
          .empty {
            text-align: center; padding: 3rem 1rem; color: #999;
            background: white; border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          .error { color: #ef4444; font-size: 0.875rem; margin-bottom: 1rem; }
          .badge {
            display: inline-block; padding: 0.125rem 0.5rem; border-radius: 9999px;
            font-size: 0.7rem; font-weight: 600; background: #dbeafe; color: #1d4ed8;
            margin-left: 0.5rem;
          }
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

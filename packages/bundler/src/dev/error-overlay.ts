/**
 * @ereo/bundler - Error Overlay
 *
 * Development error display with source mapping.
 */

/**
 * Error info for display.
 */
export interface ErrorInfo {
  message: string;
  stack?: string;
  source?: {
    file: string;
    line: number;
    column: number;
    code?: string;
  };
  type: 'runtime' | 'build' | 'syntax' | 'type';
}

/**
 * Parse an error into displayable info.
 */
export function parseError(error: Error | string): ErrorInfo {
  if (typeof error === 'string') {
    return {
      message: error,
      type: 'runtime',
    };
  }

  const info: ErrorInfo = {
    message: error.message,
    stack: error.stack,
    type: 'runtime',
  };

  // Try to extract source location from stack
  if (error.stack) {
    const match = error.stack.match(/at\s+.+\((.+):(\d+):(\d+)\)/);
    if (match) {
      info.source = {
        file: match[1],
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
      };
    }
  }

  // Detect error type
  if (error.name === 'SyntaxError') {
    info.type = 'syntax';
  } else if (error.name === 'TypeError') {
    info.type = 'type';
  }

  return info;
}

/**
 * Generate HTML for error overlay.
 */
export function generateErrorOverlayHTML(error: ErrorInfo): string {
  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const typeColors: Record<ErrorInfo['type'], string> = {
    runtime: '#ff5555',
    build: '#ffaa00',
    syntax: '#ff55ff',
    type: '#5555ff',
  };

  const typeLabels: Record<ErrorInfo['type'], string> = {
    runtime: 'Runtime Error',
    build: 'Build Error',
    syntax: 'Syntax Error',
    type: 'Type Error',
  };

  const sourceSection = error.source
    ? `
    <div style="margin-top: 1rem; padding: 1rem; background: #1a1a1a; border-radius: 4px;">
      <div style="color: #888; margin-bottom: 0.5rem;">
        ${escapeHtml(error.source.file)}:${error.source.line}:${error.source.column}
      </div>
      ${error.source.code ? `<pre style="color: #fff; margin: 0;">${escapeHtml(error.source.code)}</pre>` : ''}
    </div>
  `
    : '';

  const stackSection = error.stack
    ? `
    <details style="margin-top: 1rem;">
      <summary style="cursor: pointer; color: #888;">Stack Trace</summary>
      <pre style="color: #666; margin-top: 0.5rem; white-space: pre-wrap;">${escapeHtml(error.stack)}</pre>
    </details>
  `
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Error - Ereo Dev</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 2rem;
      background: #111;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    h1 {
      margin: 1rem 0;
      font-size: 1.5rem;
      font-weight: 500;
    }
    pre {
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge" style="background: ${typeColors[error.type]}20; color: ${typeColors[error.type]};">
      ${typeLabels[error.type]}
    </div>
    <h1>${escapeHtml(error.message)}</h1>
    ${sourceSection}
    ${stackSection}
    <p style="margin-top: 2rem; color: #666; font-size: 0.875rem;">
      Fix the error and save the file to see changes.
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Create error overlay response.
 */
export function createErrorResponse(error: Error | string): Response {
  const info = parseError(error);
  const html = generateErrorOverlayHTML(info);

  return new Response(html, {
    status: 500,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}

/**
 * Create error JSON response.
 */
export function createErrorJSON(error: Error | string): Response {
  const info = parseError(error);

  return new Response(JSON.stringify(info), {
    status: 500,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Client-side error overlay script.
 */
export const ERROR_OVERLAY_SCRIPT = `
<script>
(function() {
  window.addEventListener('error', function(event) {
    showOverlay({
      message: event.message,
      source: {
        file: event.filename,
        line: event.lineno,
        column: event.colno,
      },
      type: 'runtime',
    });
  });

  window.addEventListener('unhandledrejection', function(event) {
    const error = event.reason;
    showOverlay({
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      type: 'runtime',
    });
  });

  function showOverlay(error) {
    let overlay = document.getElementById('ereo-error-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'ereo-error-overlay';
    overlay.innerHTML = \`
      <style>
        #ereo-error-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.95);
          color: #fff;
          padding: 2rem;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          overflow: auto;
          z-index: 99999;
        }
        #ereo-error-overlay .close {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: none;
          border: 1px solid #666;
          color: #fff;
          padding: 0.5rem 1rem;
          cursor: pointer;
          border-radius: 4px;
        }
        #ereo-error-overlay .close:hover {
          background: #333;
        }
        #ereo-error-overlay h2 {
          color: #ff5555;
          margin: 0 0 1rem;
        }
        #ereo-error-overlay pre {
          background: #1a1a1a;
          padding: 1rem;
          border-radius: 4px;
          overflow-x: auto;
          color: #888;
        }
      </style>
      <button class="close" onclick="this.parentElement.remove()">Close (Esc)</button>
      <h2>\${escapeHtml(error.message)}</h2>
      \${error.source ? '<p style="color:#888">' + escapeHtml(error.source.file) + ':' + error.source.line + '</p>' : ''}
      \${error.stack ? '<pre>' + escapeHtml(error.stack) + '</pre>' : ''}
    \`;

    document.body.appendChild(overlay);

    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', handler);
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
})();
</script>
`;

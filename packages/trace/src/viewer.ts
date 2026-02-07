/**
 * @ereo/trace - Standalone Trace Viewer
 *
 * Self-contained HTML page at `/__ereo/traces`.
 * Vanilla JS timeline renderer (no React dependency).
 * Can be exported for sharing/bug reports.
 */

import type { Tracer, TraceData, SpanData } from './types';
import { serializeTrace, type SerializedTraceData } from './transport';

/** Generate the standalone trace viewer HTML */
export function generateViewerHTML(traces: TraceData[]): string {
  const serialized = traces.map(serializeTrace);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ereo Trace Viewer</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; background: #0d1117; color: #c9d1d9; }
    .header { padding: 16px 24px; border-bottom: 1px solid #21262d; display: flex; align-items: center; gap: 12px; }
    .header h1 { font-size: 16px; font-weight: 600; }
    .header .badge { font-size: 12px; background: #1f6feb; color: white; padding: 2px 8px; border-radius: 10px; }
    .container { display: flex; height: calc(100vh - 53px); }
    .trace-list { width: 380px; border-right: 1px solid #21262d; overflow-y: auto; }
    .trace-item { padding: 10px 16px; border-bottom: 1px solid #21262d; cursor: pointer; font-size: 13px; }
    .trace-item:hover { background: #161b22; }
    .trace-item.active { background: #1c2128; border-left: 3px solid #1f6feb; }
    .trace-item .method { font-weight: 600; width: 50px; display: inline-block; }
    .trace-item .path { color: #8b949e; }
    .trace-item .status { float: right; font-size: 12px; }
    .trace-item .duration { float: right; margin-right: 12px; font-size: 12px; }
    .status-2xx { color: #3fb950; }
    .status-3xx { color: #58a6ff; }
    .status-4xx { color: #d29922; }
    .status-5xx { color: #f85149; }
    .dur-fast { color: #3fb950; }
    .dur-medium { color: #d29922; }
    .dur-slow { color: #f85149; }
    .detail-panel { flex: 1; overflow-y: auto; padding: 16px; }
    .waterfall { padding: 8px 0; }
    .span-row { display: flex; align-items: center; padding: 4px 8px; font-size: 12px; border-radius: 4px; }
    .span-row:hover { background: #161b22; }
    .span-name { width: 200px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .span-bar-container { flex: 1; height: 20px; position: relative; margin: 0 12px; }
    .span-bar { position: absolute; height: 16px; border-radius: 3px; top: 2px; min-width: 2px; }
    .span-duration { width: 70px; text-align: right; flex-shrink: 0; font-size: 11px; color: #8b949e; }
    .layer-request { background: #8b949e; }
    .layer-routing { background: #58a6ff; }
    .layer-data { background: #1f6feb; }
    .layer-database { background: #bc8cff; }
    .layer-auth { background: #d29922; }
    .layer-rpc { background: #58a6ff; }
    .layer-forms { background: #3fb950; }
    .layer-islands { background: #bc8cff; }
    .layer-build { background: #1f6feb; }
    .layer-errors { background: #f85149; }
    .layer-signals { background: #3fb950; }
    .layer-custom { background: #8b949e; }
    .span-detail { margin-top: 16px; padding: 16px; background: #161b22; border-radius: 8px; font-size: 12px; }
    .span-detail h3 { font-size: 14px; margin-bottom: 8px; }
    .span-detail table { width: 100%; border-collapse: collapse; }
    .span-detail td { padding: 4px 8px; border-bottom: 1px solid #21262d; }
    .span-detail td:first-child { color: #8b949e; width: 150px; }
    .empty { text-align: center; padding: 48px; color: #8b949e; }
    .filters { padding: 8px 16px; border-bottom: 1px solid #21262d; display: flex; gap: 8px; font-size: 12px; }
    .filters select, .filters input { background: #0d1117; border: 1px solid #30363d; color: #c9d1d9; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Ereo Trace Viewer</h1>
    <span class="badge">${serialized.length} traces</span>
  </div>
  <div class="filters">
    <select id="filter-method"><option value="">All Methods</option><option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option></select>
    <input id="filter-path" type="text" placeholder="Filter by path..." />
    <select id="filter-status"><option value="">All Status</option><option value="2xx">2xx</option><option value="4xx">4xx</option><option value="5xx">5xx</option></select>
  </div>
  <div class="container">
    <div class="trace-list" id="trace-list"></div>
    <div class="detail-panel" id="detail-panel"><div class="empty">Select a trace to view details</div></div>
  </div>
  <script>
    const TRACES = ${JSON.stringify(serialized).replace(/<\//g, '<\\/')};
    let selectedTraceId = null;
    let selectedSpanId = null;

    function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    function durClass(ms) { return ms < 50 ? 'dur-fast' : ms < 200 ? 'dur-medium' : 'dur-slow'; }
    function statusClass(code) {
      if (code < 300) return 'status-2xx';
      if (code < 400) return 'status-3xx';
      if (code < 500) return 'status-4xx';
      return 'status-5xx';
    }
    function fmtDur(ms) { return ms < 1 ? (ms*1000).toFixed(0)+'us' : ms < 1000 ? ms.toFixed(1)+'ms' : (ms/1000).toFixed(2)+'s'; }

    function renderTraceList(traces) {
      const el = document.getElementById('trace-list');
      if (!traces.length) { el.innerHTML = '<div class="empty">No traces recorded</div>'; return; }
      el.innerHTML = traces.map(t => {
        const s = t.metadata.statusCode || 200;
        const d = t.duration;
        return '<div class="trace-item'+(t.id===selectedTraceId?' active':'')+'" data-id="'+esc(t.id)+'">' +
          '<span class="method">'+esc(t.metadata.method||'GET')+'</span>' +
          '<span class="path">'+esc(t.metadata.pathname||'/')+'</span>' +
          '<span class="status '+statusClass(s)+'">'+s+'</span>' +
          '<span class="duration '+durClass(d)+'">'+fmtDur(d)+'</span>' +
          '</div>';
      }).join('');
      el.querySelectorAll('.trace-item').forEach(item => {
        item.onclick = () => { selectedTraceId = item.dataset.id; selectedSpanId = null; render(); };
      });
    }

    function flattenSpans(trace) {
      const spans = Object.values(trace.spans);
      const root = spans.find(s => s.id === trace.rootSpanId);
      if (!root) return spans;
      const result = [];
      function walk(span, depth) {
        result.push({ ...span, depth });
        const children = spans.filter(s => s.parentId === span.id).sort((a,b) => a.startTime - b.startTime);
        children.forEach(c => walk(c, depth+1));
      }
      walk(root, 0);
      return result;
    }

    function renderDetail(trace) {
      const panel = document.getElementById('detail-panel');
      if (!trace) { panel.innerHTML = '<div class="empty">Select a trace to view details</div>'; return; }
      const spans = flattenSpans(trace);
      const minTime = trace.startTime;
      const totalDur = trace.duration || 1;
      let html = '<div class="waterfall">';
      spans.forEach(s => {
        const left = ((s.startTime - minTime) / totalDur * 100).toFixed(2);
        const width = Math.max(0.5, (s.duration / totalDur * 100));
        const indent = s.depth * 16;
        html += '<div class="span-row'+(s.id===selectedSpanId?' active':'')+'" data-span="'+esc(s.id)+'">' +
          '<div class="span-name" style="padding-left:'+indent+'px">'+esc(s.name)+'</div>' +
          '<div class="span-bar-container"><div class="span-bar layer-'+esc(s.layer)+'" style="left:'+left+'%;width:'+width.toFixed(2)+'%"></div></div>' +
          '<div class="span-duration '+durClass(s.duration)+'">'+fmtDur(s.duration)+'</div>' +
          '</div>';
      });
      html += '</div>';
      if (selectedSpanId) {
        const span = trace.spans[selectedSpanId];
        if (span) {
          html += '<div class="span-detail"><h3>'+esc(span.name)+' ('+esc(span.layer)+')</h3><table>';
          html += '<tr><td>Status</td><td>'+esc(span.status)+'</td></tr>';
          html += '<tr><td>Duration</td><td>'+fmtDur(span.duration)+'</td></tr>';
          Object.entries(span.attributes||{}).forEach(([k,v]) => { html += '<tr><td>'+esc(k)+'</td><td>'+esc(v)+'</td></tr>'; });
          if (span.events && span.events.length) {
            html += '<tr><td>Events</td><td>'+span.events.map(e=>esc(e.name)).join(', ')+'</td></tr>';
          }
          html += '</table></div>';
        }
      }
      panel.innerHTML = html;
      panel.querySelectorAll('.span-row').forEach(row => {
        row.onclick = () => { selectedSpanId = row.dataset.span; renderDetail(trace); };
      });
    }

    function getFiltered() {
      let t = TRACES;
      const method = document.getElementById('filter-method').value;
      const path = document.getElementById('filter-path').value;
      const status = document.getElementById('filter-status').value;
      if (method) t = t.filter(x => x.metadata.method === method);
      if (path) t = t.filter(x => (x.metadata.pathname||'').includes(path));
      if (status) {
        const base = parseInt(status);
        t = t.filter(x => { const s = x.metadata.statusCode||200; return s >= base && s < base+100; });
      }
      return t.reverse();
    }

    function render() {
      const filtered = getFiltered();
      renderTraceList(filtered);
      const trace = selectedTraceId ? TRACES.find(t => t.id === selectedTraceId) : null;
      renderDetail(trace);
    }

    document.getElementById('filter-method').onchange = render;
    document.getElementById('filter-path').oninput = render;
    document.getElementById('filter-status').onchange = render;
    render();

    // Live updates via WebSocket
    if (typeof WebSocket !== 'undefined') {
      try {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(protocol + '//' + location.host + '/__ereo/trace-ws');
        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'trace:end') {
              TRACES.push(data.trace);
              render();
            }
          } catch {}
        };
      } catch {}
    }
  </script>
</body>
</html>`;
}

/**
 * Create an HTTP handler that serves the standalone trace viewer.
 */
export function createViewerHandler(tracer: Tracer): (request: Request) => Response {
  return () => {
    const traces = tracer.getTraces();
    const html = generateViewerHTML(traces);
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  };
}

/**
 * Export traces as a self-contained HTML file string.
 * For CLI: `ereo trace export > traces.html`
 */
export function exportTracesHTML(tracer: Tracer): string {
  return generateViewerHTML(tracer.getTraces());
}

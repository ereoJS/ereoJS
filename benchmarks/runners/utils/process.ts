import { spawn, type Subprocess } from 'bun';

export interface ServerProcess {
  proc: Subprocess;
  port: number;
  framework: string;
}

export async function spawnServer(opts: {
  command: string[];
  cwd: string;
  port: number;
  framework: string;
  env?: Record<string, string>;
}): Promise<ServerProcess> {
  const proc = spawn({
    cmd: opts.command,
    cwd: opts.cwd,
    env: { ...process.env, ...opts.env, NODE_ENV: 'production' },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  return { proc, port: opts.port, framework: opts.framework };
}

export async function waitForReady(port: number, timeoutMs: number = 30000): Promise<number> {
  const start = performance.now();
  const deadline = start + timeoutMs;

  while (performance.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${port}/`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok || res.status < 500) {
        return performance.now() - start;
      }
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server on port ${port} not ready after ${timeoutMs}ms`);
}

export async function killServer(server: ServerProcess): Promise<void> {
  try {
    server.proc.kill();
    // Wait a bit for cleanup
    await new Promise((r) => setTimeout(r, 500));
  } catch {
    // already dead
  }
}

export async function isPortInUse(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${port}/`, {
      signal: AbortSignal.timeout(1000),
    });
    return true;
  } catch {
    return false;
  }
}

export async function killPortProcess(port: number): Promise<void> {
  try {
    const proc = spawn({
      cmd: ['lsof', '-ti', `:${port}`],
      stdout: 'pipe',
    });
    const text = await new Response(proc.stdout).text();
    const pids = text.trim().split('\n').filter(Boolean);
    for (const pid of pids) {
      spawn({ cmd: ['kill', '-9', pid] });
    }
    await new Promise((r) => setTimeout(r, 500));
  } catch {
    // no process on port
  }
}

import type { FlueServer } from './types.js';

export const DEFAULT_PORTS = [3583, 8787, 3000, 5173] as const;

function normalizeUrl(input: string): string {
  return input.replace(/\/$/, '');
}

async function probeUrl(url: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok || response.status === 404 || response.status === 405;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function discoverServers(options: { ports?: readonly number[]; host?: string; timeoutMs?: number } = {}): Promise<FlueServer[]> {
  const host = options.host ?? '127.0.0.1';
  const timeoutMs = options.timeoutMs ?? 300;
  const ports = options.ports ?? DEFAULT_PORTS;
  const found: FlueServer[] = [];
  for (const port of ports) {
    const url = `http://${host}:${port}`;
    if (await probeUrl(url, timeoutMs)) found.push({ url, label: `localhost:${port}` });
  }
  return found;
}

export function explicitServer(url: string): FlueServer {
  const normalized = normalizeUrl(url);
  return { url: normalized, label: normalized };
}

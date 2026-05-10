import { readdir } from 'node:fs/promises';
import { join, parse } from 'node:path';
import type { AgentCandidate, FlueServer } from './types.js';

export const DEFAULT_PORTS = [3583, 3584, 3585, 3586, 8787, 3000, 5173] as const;

function normalizeUrl(input: string): string {
  return input.replace(/\/$/, '');
}

async function probeUrl(url: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${url}/agents/__flue_tui_probe__/probe`, {
      method: 'POST',
      body: '{}',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    return response.status === 404 || response.status === 405 || response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function discoverServers(options: { ports?: readonly number[]; host?: string; timeoutMs?: number } = {}): Promise<FlueServer[]> {
  const host = options.host ?? '127.0.0.1';
  const timeoutMs = options.timeoutMs ?? 400;
  const ports = options.ports ?? DEFAULT_PORTS;
  const found: FlueServer[] = [];
  await Promise.all(ports.map(async (port) => {
    const url = `http://${host}:${port}`;
    if (await probeUrl(url, timeoutMs)) found.push({ url, label: `localhost:${port}` });
  }));
  return found.sort((a, b) => a.url.localeCompare(b.url));
}

export function explicitServer(url: string): FlueServer {
  const normalized = normalizeUrl(url);
  return { url: normalized, label: normalized };
}

export async function discoverAgents(root = process.cwd()): Promise<string[]> {
  const sourceRoot = await hasEntries(join(root, '.flue')) ? join(root, '.flue') : root;
  const agentsDir = join(sourceRoot, 'agents');
  try {
    const entries = await readdir(agentsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && /\.(ts|mts|js|mjs)$/.test(entry.name))
      .map((entry) => parse(entry.name).name)
      .sort();
  } catch {
    return [];
  }
}

export async function discoverCandidates(options: { url?: string; root?: string; ports?: readonly number[] } = {}): Promise<AgentCandidate[]> {
  const servers = options.url ? [explicitServer(options.url)] : await discoverServers({ ports: options.ports });
  const agents = await discoverAgents(options.root);
  return servers.flatMap((server) => agents.map((agent) => ({ server, agent })));
}

async function hasEntries(path: string): Promise<boolean> {
  try {
    return (await readdir(path)).length > 0;
  } catch {
    return false;
  }
}

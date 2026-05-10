import { createParser, type EventSourceMessage } from 'eventsource-parser';
import type { AgentTarget, FlueEvent } from './types.js';

function parseData(data: string): unknown {
  if (!data) return null;
  try { return JSON.parse(data) as unknown; } catch { return data; }
}

export function agentUrl(target: AgentTarget): string {
  const base = target.serverUrl.replace(/\/$/, '');
  const agent = encodeURIComponent(target.agent);
  const id = encodeURIComponent(target.id);
  return `${base}/agents/${agent}/${id}`;
}

function buildBody(payload: unknown): BodyInit {
  return JSON.stringify(payload ?? {});
}

export async function* streamAgentEvents(target: AgentTarget, init: RequestInit = {}): AsyncGenerator<FlueEvent> {
  const url = agentUrl(target);
  const response = await fetch(url, {
    ...init,
    method: 'POST',
    body: buildBody(target.payload),
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => '');
    throw new Error(`${url} returned ${response.status}${body ? `: ${body}` : ''}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const queue: FlueEvent[] = [];
  const parser = createParser({
    onEvent(message: EventSourceMessage) {
      queue.push({ event: message.event || 'message', data: parseData(message.data), raw: message.data });
    },
  });

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    parser.feed(decoder.decode(value, { stream: true }));
    while (queue.length > 0) yield queue.shift()!;
  }
  parser.feed(decoder.decode());
  while (queue.length > 0) yield queue.shift()!;
}

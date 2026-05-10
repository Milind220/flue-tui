import { createParser, type EventSourceMessage } from 'eventsource-parser';
import type { AgentTarget, FlueEvent } from './types.js';

function parseData(data: string): unknown {
  if (!data) return null;
  try { return JSON.parse(data) as unknown; } catch { return data; }
}

function candidateUrls(target: AgentTarget): string[] {
  const base = target.serverUrl.replace(/\/$/, '');
  const agent = encodeURIComponent(target.agent);
  const id = encodeURIComponent(target.id);
  return [`${base}/agents/${agent}/${id}`, `${base}/${agent}/${id}`, `${base}/${agent}?id=${id}`];
}

function buildBody(payload: unknown): BodyInit | undefined {
  if (payload === undefined) return undefined;
  return JSON.stringify(payload);
}

export async function* streamAgentEvents(target: AgentTarget, init: RequestInit = {}): AsyncGenerator<FlueEvent> {
  let lastError: Error | undefined;
  for (const url of candidateUrls(target)) {
    try {
      const response = await fetch(url, {
        method: target.payload === undefined ? 'GET' : 'POST',
        body: buildBody(target.payload),
        headers: {
          Accept: 'text/event-stream',
          ...(target.payload === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...init.headers,
        },
        ...init,
      });
      if (!response.ok || !response.body) {
        lastError = new Error(`${url} returned ${response.status}`);
        continue;
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
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError ?? new Error('No Flue SSE endpoint responded');
}

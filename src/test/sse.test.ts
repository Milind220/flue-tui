import { createServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { streamAgentEvents } from '../sse.js';

const servers: Array<{ close: (callback: () => void) => void }> = [];

afterEach(async () => {
  await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(resolve))));
  servers.length = 0;
});

async function fixtureServer(): Promise<string> {
  const server = createServer((request, response) => {
    if (request.url === '/agents/hello/run-1') {
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      response.write('event: text\n');
      response.write('data: {"text":"Hello"}\n\n');
      response.write('event: tool_start\n');
      response.write('data: {"name":"search"}\n\n');
      response.end('event: idle\ndata: {"type":"idle"}\n\n');
      return;
    }
    response.writeHead(404).end();
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing address');
  return `http://127.0.0.1:${address.port}`;
}

describe('streamAgentEvents', () => {
  it('parses named SSE events from a Flue-style agent endpoint', async () => {
    const serverUrl = await fixtureServer();
    const events = [];
    for await (const event of streamAgentEvents({ serverUrl, agent: 'hello', id: 'run-1' })) events.push(event);
    expect(events).toEqual([
      { event: 'text', data: { text: 'Hello' }, raw: '{"text":"Hello"}' },
      { event: 'tool_start', data: { name: 'search' }, raw: '{"name":"search"}' },
      { event: 'idle', data: { type: 'idle' }, raw: '{"type":"idle"}' },
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { payloadFromPrompt, targetForPrompt } from '../chat.js';

describe('chat helpers', () => {
  it('turns plain text prompts into Flue prompt payloads', () => {
    expect(payloadFromPrompt('hello flue')).toEqual({ prompt: 'hello flue' });
  });

  it('passes JSON payloads through for custom Flue agents', () => {
    expect(payloadFromPrompt('{"name":"Milind"}')).toEqual({ name: 'Milind' });
  });

  it('creates stable per-turn invocation ids', () => {
    expect(targetForPrompt({ serverUrl: 'http://x', agent: 'a', id: 'chat' }, 'yo', 3)).toMatchObject({
      id: 'chat-3',
      payload: { prompt: 'yo' },
    });
  });
});

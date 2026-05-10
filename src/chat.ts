import { chalk } from './theme.js';
import type { AgentTarget, FlueEvent } from './types.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'event' | 'error';
  text: string;
}

export function payloadFromPrompt(prompt: string): unknown {
  const trimmed = prompt.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return { prompt };
  }
}

export function targetForPrompt(base: AgentTarget, prompt: string, turn: number): AgentTarget {
  return {
    ...base,
    id: `${base.id}-${turn}`,
    payload: payloadFromPrompt(prompt),
  };
}

export function appendEventText(current: string, event: FlueEvent, rendered: string): string {
  if (event.event === 'text_delta' || event.event === 'thinking_delta') return current + rendered;
  return current ? `${current}${rendered}` : rendered.trimStart();
}

export function formatHeader(target: AgentTarget, status: string): string {
  return [
    chalk.bold.cyan('flue-tui'),
    chalk.dim('  '),
    chalk.white(target.agent),
    chalk.dim(` @ ${target.serverUrl}`),
    chalk.dim(`  ${status}`),
  ].join('');
}

export function formatFooter(target: AgentTarget, status: string, turns: number): string {
  return chalk.dim(`${target.serverUrl} • ${target.agent} • ${turns} turn${turns === 1 ? '' : 's'} • ${status} • Ctrl+D or /exit quits`);
}

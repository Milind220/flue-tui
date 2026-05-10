import chalk from 'chalk';
import type { FlueEvent } from './types.js';

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function pickText(data: unknown): string {
  if (typeof data === 'string') return data;
  const record = asRecord(data);
  const text = record?.text ?? record?.content ?? record?.message ?? record?.delta;
  if (typeof text === 'string') return text;
  return JSON.stringify(data, null, 2);
}

function eventPayload(event: FlueEvent): unknown {
  const record = asRecord(event.data);
  return record?.type === event.event ? event.data : event.data;
}

export function renderEvent(event: FlueEvent): string {
  const data = eventPayload(event);
  const record = asRecord(data);
  switch (event.event) {
    case 'text':
    case 'message':
      return pickText(data);
    case 'text_delta':
      return record && typeof record.text === 'string' ? record.text : pickText(data);
    case 'thinking_start':
      return chalk.dim('\n[thinking]');
    case 'thinking_delta':
      return chalk.dim(record && typeof record.delta === 'string' ? record.delta : pickText(data));
    case 'thinking_end':
      return chalk.dim('\n[/thinking]');
    case 'agent_start':
      return chalk.dim('\n[agent:start]');
    case 'turn_end':
      return chalk.dim('\n[turn:end]');
    case 'tool_start': {
      const name = typeof record?.toolName === 'string' ? record.toolName : 'tool';
      return chalk.cyan(`\n↳ ${name} ${JSON.stringify(record?.args ?? {})}`);
    }
    case 'tool_end': {
      const name = typeof record?.toolName === 'string' ? record.toolName : 'tool';
      const errored = record?.isError === true;
      return (errored ? chalk.red : chalk.green)(`\n${errored ? '✗' : '✓'} ${name}`);
    }
    case 'result':
      return chalk.bold(`\n[result] ${pickText(record?.data ?? data)}`);
    case 'error':
      return chalk.red(`\n✗ ${pickText(record?.error ?? data)}`);
    case 'idle':
      return chalk.dim('\n… idle');
    default:
      return chalk.dim(`\n[${event.event}] ${pickText(data)}`);
  }
}

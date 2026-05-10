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

export function renderEvent(event: FlueEvent): string {
  switch (event.event) {
    case 'text':
    case 'message':
      return pickText(event.data);
    case 'tool_start':
      return chalk.cyan(`\n↳ tool start ${pickText(event.data)}`);
    case 'tool_end':
      return chalk.green(`\n✓ tool end ${pickText(event.data)}`);
    case 'error':
      return chalk.red(`\n✗ ${pickText(event.data)}`);
    case 'idle':
      return chalk.dim('\n… idle');
    default:
      return chalk.dim(`\n[${event.event}] ${pickText(event.data)}`);
  }
}

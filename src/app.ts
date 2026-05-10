import { TUI, Text, Box, Markdown } from '@earendil-works/pi-tui';
import chalk from 'chalk';
import { streamAgentEvents } from './sse.js';
import { renderEvent } from './render.js';
import type { AgentTarget, ConnectionStatus, FlueEvent } from './types.js';

export interface RunOptions {
  target: AgentTarget;
  headless?: boolean;
}

export async function runHeadless(target: AgentTarget): Promise<void> {
  process.stderr.write(chalk.dim(`connecting ${target.serverUrl} → ${target.agent}/${target.id}\n`));
  for await (const event of streamAgentEvents(target)) process.stdout.write(renderEvent(event));
  process.stdout.write('\n');
}

export async function runTui(options: RunOptions): Promise<void> {
  if (options.headless || !process.stdin.isTTY || !process.stdout.isTTY) {
    await runHeadless(options.target);
    return;
  }

  const tui = new TUI();
  const events: FlueEvent[] = [];
  let status: ConnectionStatus = 'connecting';

  const redraw = (): void => {
    const body = events.map(renderEvent).join('\n');
    tui.setRoot(
      new Box({
        title: `flue-tui ${options.target.agent}/${options.target.id} ${status}`,
        child: new Markdown(body || chalk.dim('Waiting for events...')),
      }),
    );
    tui.render();
  };

  tui.setRoot(new Text('Connecting to Flue...'));
  tui.render();

  try {
    for await (const event of streamAgentEvents(options.target)) {
      status = 'connected';
      events.push(event);
      redraw();
    }
    status = 'closed';
    redraw();
  } catch (error) {
    status = 'error';
    events.push({ event: 'error', data: error instanceof Error ? error.message : String(error), raw: '' });
    redraw();
  } finally {
    tui.close();
  }
}

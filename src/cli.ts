#!/usr/bin/env node
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { discoverAgents, discoverCandidates, discoverServers, explicitServer } from './discovery.js';
import { runTui } from './app.js';
import type { AgentCandidate, AgentTarget, FlueServer } from './types.js';

function parsePayload(value: string | undefined): unknown {
  if (value === undefined) return undefined;
  try { return JSON.parse(value) as unknown; } catch { return { prompt: value }; }
}

async function choose<T>(label: string, items: T[], render: (item: T, index: number) => string): Promise<T> {
  if (items.length === 0) throw new Error(`No ${label} found.`);
  if (items.length === 1) return items[0]!;
  const rl = readline.createInterface({ input, output });
  try {
    console.log(`\n${label}:`);
    items.forEach((item, index) => console.log(`  ${index + 1}. ${render(item, index)}`));
    while (true) {
      const answer = await rl.question('Select number: ');
      const selected = Number(answer.trim());
      if (Number.isInteger(selected) && selected >= 1 && selected <= items.length) return items[selected - 1]!;
      console.log('Invalid selection. Tiny tragedy. Try again.');
    }
  } finally {
    rl.close();
  }
}

async function promptPayload(): Promise<unknown> {
  if (!input.isTTY) return {};
  const rl = readline.createInterface({ input, output });
  try {
    const text = await rl.question('Prompt/payload (blank = {}): ');
    if (!text.trim()) return {};
    try { return JSON.parse(text) as unknown; } catch { return { prompt: text }; }
  } finally {
    rl.close();
  }
}

const argv = await yargs(hideBin(process.argv))
  .scriptName('flue-tui')
  .option('url', { type: 'string', describe: 'Flue dev server URL' })
  .option('root', { type: 'string', default: process.cwd(), describe: 'Flue project root used to discover agent files' })
  .option('agent', { type: 'string', describe: 'Agent name. Omit to select from discovered agents.' })
  .option('id', { type: 'string', default: `tui-${Date.now()}`, describe: 'Invocation/session id' })
  .option('payload', { type: 'string', describe: 'JSON payload or prompt text. Omit in TTY to be prompted.' })
  .option('headless', { type: 'boolean', default: false, describe: 'Print stream without TUI' })
  .option('list', { type: 'boolean', default: false, describe: 'List discovered server/agent candidates and exit' })
  .help()
  .parse();

const servers: FlueServer[] = argv.url ? [explicitServer(argv.url)] : await discoverServers();
const agents = argv.agent ? [argv.agent] : await discoverAgents(argv.root);
const candidates: AgentCandidate[] = argv.agent
  ? servers.map((server) => ({ server, agent: argv.agent! }))
  : await discoverCandidates({ url: argv.url, root: argv.root });

if (argv.list) {
  for (const candidate of candidates) console.log(`${candidate.server.url}\t${candidate.agent}`);
  process.exit(0);
}

const candidate = await choose('Flue agents', candidates.length ? candidates : servers.flatMap((server) => agents.map((agent) => ({ server, agent }))), (item) => `${item.server.label} → ${item.agent}`);

const target: AgentTarget = {
  serverUrl: candidate.server.url,
  agent: candidate.agent,
  id: argv.id,
  payload: argv.payload === undefined ? await promptPayload() : parsePayload(argv.payload),
};

await runTui({ target, headless: argv.headless });

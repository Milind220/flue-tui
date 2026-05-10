#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { discoverServers, explicitServer } from './discovery.js';
import { runTui } from './app.js';
import type { AgentTarget } from './types.js';

function parsePayload(value: string | undefined): unknown {
  if (value === undefined) return undefined;
  try { return JSON.parse(value) as unknown; } catch { return value; }
}

const argv = await yargs(hideBin(process.argv))
  .scriptName('flue-tui')
  .option('url', { type: 'string', describe: 'Flue dev server URL' })
  .option('agent', { type: 'string', demandOption: true, describe: 'Agent name' })
  .option('id', { type: 'string', default: `tui-${Date.now()}`, describe: 'Invocation/session id' })
  .option('payload', { type: 'string', describe: 'JSON payload or raw text' })
  .option('headless', { type: 'boolean', default: false, describe: 'Print stream without TUI' })
  .help()
  .parse();

const server = argv.url ? explicitServer(argv.url) : (await discoverServers())[0];
if (!server) throw new Error('No Flue dev server found. Pass --url http://localhost:3583.');

const target: AgentTarget = {
  serverUrl: server.url,
  agent: argv.agent,
  id: argv.id,
  payload: parsePayload(argv.payload),
};

await runTui({ target, headless: argv.headless });

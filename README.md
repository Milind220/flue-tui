# flue-tui

A Pi-inspired terminal UI for Flue dev agents.

Flue dev servers expose agents over HTTP/SSE. `flue-tui` gives you a small terminal client that can discover local dev servers, pick an agent, send payloads, and watch the agent event stream without copy-pasting curl commands like a cave goblin.

## Install

```bash
npm install -g flue-tui
```

Or from source:

```bash
npm install
npm run build
node dist/cli.js --help
```

## Usage

```bash
flue-tui
flue-tui --url http://localhost:3583 --agent hello
flue-tui --headless --url http://localhost:3583 --agent hello --id demo-1 --payload '{"name":"Milind"}'
```

If you omit `--url`, it probes common Flue dev ports including `3583`. If multiple server/agent pairs are found, you get a Pi-style keyboard selector.

Inside the TUI:

- Type a plain prompt to send `{ "prompt": "..." }`
- Type JSON to send raw payload
- `/help`, `/clear`, `/exit` do the obvious things. Miracles sold separately.

## Status

Early dev tool. Built to track Flue's current dev-server SSE shape:

- `GET /` or `/health` for server probing when available
- agent invocation via SSE request using `Accept: text/event-stream`
- event rendering for `text`, `message`, `tool_start`, `tool_end`, `error`, `idle`, and unknown events

## Why

Flue has `flue dev`; agents emit useful SSE. Humans need a cockpit. This is that cockpit, minus the ejector seat. For now.

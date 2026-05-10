import {
  CombinedAutocompleteProvider,
  Container,
  Editor,
  Loader,
  Markdown,
  ProcessTerminal,
  Spacer,
  Text,
  TUI,
} from '@earendil-works/pi-tui';
import { appendEventText, formatFooter, formatHeader, targetForPrompt } from './chat.js';
import { renderEvent } from './render.js';
import { streamAgentEvents } from './sse.js';
import { chalk, editorTheme, markdownTheme } from './theme.js';
import type { AgentTarget, FlueEvent } from './types.js';

export interface RunOptions {
  target: AgentTarget;
  headless?: boolean;
}

export async function runHeadless(target: AgentTarget): Promise<void> {
  process.stderr.write(chalk.dim(`connecting ${target.serverUrl} → ${target.agent}/${target.id}\n`));
  for await (const event of streamAgentEvents(target)) process.stdout.write(renderEvent(event));
  process.stdout.write('\n');
}

function messageMarkdown(role: 'user' | 'assistant' | 'system' | 'error', text: string): Markdown {
  const label = role === 'user' ? chalk.bold.blue('You') : role === 'assistant' ? chalk.bold.green('Flue') : role === 'error' ? chalk.bold.red('Error') : chalk.bold.cyan('System');
  return new Markdown(`${label}\n${text}`, 1, 1, markdownTheme);
}

function eventDataRecord(event: FlueEvent): Record<string, unknown> | undefined {
  return event.data && typeof event.data === 'object' ? event.data as Record<string, unknown> : undefined;
}

function isAssistantContent(event: FlueEvent): boolean {
  return ['text', 'message', 'text_delta', 'thinking_start', 'thinking_delta', 'thinking_end', 'tool_start', 'tool_end', 'turn_end', 'result'].includes(event.event);
}

export async function runTui(options: RunOptions): Promise<void> {
  if (options.headless || !process.stdin.isTTY || !process.stdout.isTTY) {
    await runHeadless(options.target);
    return;
  }

  const terminal = new ProcessTerminal();
  const tui = new TUI(terminal);
  const header = new Text(formatHeader(options.target, 'idle'));
  const chat = new Container();
  const footer = new Text(formatFooter(options.target, 'idle', 0));
  const editor = new Editor(tui, editorTheme, { autocompleteMaxVisible: 8 });
  const autocomplete = new CombinedAutocompleteProvider([
    { name: 'help', description: 'Show commands' },
    { name: 'clear', description: 'Clear the transcript' },
    { name: 'exit', description: 'Quit flue-tui' },
  ], process.cwd());

  editor.setAutocompleteProvider(autocomplete);
  editor.onChange = () => tui.requestRender();

  tui.addChild(header);
  tui.addChild(new Spacer(1));
  tui.addChild(chat);
  tui.addChild(new Spacer(1));
  tui.addChild(footer);
  tui.addChild(editor);
  tui.setFocus(editor);

  let running = false;
  let turns = 0;
  let stopped = false;

  const setStatus = (status: string): void => {
    header.setText(formatHeader(options.target, status));
    footer.setText(formatFooter(options.target, status, turns));
    tui.requestRender(true);
  };

  const addMessage = (role: 'user' | 'assistant' | 'system' | 'error', text: string): Markdown => {
    const component = messageMarkdown(role, text);
    chat.addChild(component);
    tui.requestRender(true);
    return component;
  };

  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    tui.stop();
  };

  process.once('SIGINT', stop);

  addMessage('system', `Connected to **${options.target.agent}** on \`${options.target.serverUrl}\`.\nType a prompt. JSON is sent as raw payload. Plain text becomes \`{ prompt }\`.`);

  editor.onSubmit = (value: string): void => {
    const text = value.trim();
    if (!text || running) return;
    if (text === '/exit' || text === '/quit') {
      stop();
      return;
    }
    if (text === '/clear') {
      chat.clear();
      addMessage('system', 'Transcript cleared. The void applauds politely.');
      return;
    }
    if (text === '/help') {
      addMessage('system', ['Commands:', '- `/help` show this', '- `/clear` clear transcript', '- `/exit` quit', '', 'Plain text sends `{ prompt: text }`; JSON sends raw payload.'].join('\n'));
      return;
    }

    turns += 1;
    running = true;
    editor.disableSubmit = true;
    addMessage('user', text);
    const loader = new Loader(tui, (s) => chalk.cyan(s), (s) => chalk.dim(s), 'Working...');
    chat.addChild(loader);
    setStatus('running');

    void (async () => {
      let assistantText = '';
      let assistantComponent: Markdown | undefined;
      try {
        const target = targetForPrompt(options.target, text, turns);
        for await (const event of streamAgentEvents(target)) {
          if (!isAssistantContent(event)) continue;
          if (!assistantComponent) {
            chat.removeChild(loader);
            assistantComponent = addMessage('assistant', '');
          }
          const rendered = renderEvent(event);
          assistantText = appendEventText(assistantText, event, rendered);
          const record = eventDataRecord(event);
          if (event.event === 'result' && typeof record?.data === 'object') {
            const data = record.data as Record<string, unknown>;
            if (typeof data.text === 'string') assistantText = data.text;
          }
          if (assistantComponent) chat.removeChild(assistantComponent);
          assistantComponent = messageMarkdown('assistant', assistantText.trimStart());
          chat.addChild(assistantComponent);
          tui.requestRender(true);
        }
        if (!assistantComponent) {
          chat.removeChild(loader);
          addMessage('assistant', chalk.dim('(no events)'));
        }
        setStatus('idle');
      } catch (error) {
        chat.removeChild(loader);
        addMessage('error', error instanceof Error ? error.message : String(error));
        setStatus('error');
      } finally {
        running = false;
        editor.disableSubmit = false;
        tui.setFocus(editor);
        tui.requestRender(true);
      }
    })();
  };

  tui.start();
}

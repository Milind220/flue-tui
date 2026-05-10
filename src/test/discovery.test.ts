import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverAgents } from '../discovery.js';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  dirs.length = 0;
});

describe('discoverAgents', () => {
  it('discovers agent filenames from .flue/agents', async () => {
    const root = await mkdtemp(join(tmpdir(), 'flue-tui-'));
    dirs.push(root);
    await mkdir(join(root, '.flue', 'agents'), { recursive: true });
    await writeFile(join(root, '.flue', 'agents', 'cheap-chat.ts'), 'export default function() {}');
    await writeFile(join(root, '.flue', 'agents', 'no-llm.mjs'), 'export default function() {}');
    await writeFile(join(root, '.flue', 'agents', 'README.md'), 'ignore me');
    await expect(discoverAgents(root)).resolves.toEqual(['cheap-chat', 'no-llm']);
  });
});

import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {create} from 'tar';
import {parseAgents, resolveTargets, type SkillDirOverrides} from '../../src/lib/skills/agents.js';
import {loadSkills, searchSkills} from '../../src/lib/skills/catalog.js';
import {installPayload, loadRemoteSkillPayload, removeSkill} from '../../src/lib/skills/install.js';
import {loadLocalCliSkill} from '../../src/lib/skills/local.js';

const originalFetch = globalThis.fetch;

describe('skills library', () => {
  let tempDir: string;
  let skillDirs: SkillDirOverrides;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bitmovin-skills-test-'));
    skillDirs = {
      pi: path.join(tempDir, 'pi'),
      claude: path.join(tempDir, 'claude'),
      codex: path.join(tempDir, 'codex'),
      gemini: path.join(tempDir, 'gemini'),
    };
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    await fs.rm(tempDir, {recursive: true, force: true});
  });

  it('parses and validates supported agents', () => {
    expect(parseAgents('pi,claude')).toEqual(['pi', 'claude']);
    expect(parseAgents('pi,pi,claude')).toEqual(['pi', 'claude']);
    expect(() => parseAgents('unknown')).toThrow('Unsupported agent');
    expect(() => parseAgents('')).toThrow('No agents specified');
  });

  it('only auto-detects existing target directories', async () => {
    await fs.mkdir(path.join(tempDir, 'pi'), {recursive: true});
    expect(resolveTargets(undefined, skillDirs).map(target => target.agent)).toEqual(['pi']);
  });

  it('loads the packaged local CLI skill', async () => {
    const skill = await loadLocalCliSkill();
    expect(skill.name).toBe('bitmovin-cli');
    expect(skill.files).toHaveLength(1);
    expect(skill.files[0].path).toBe('SKILL.md');
    expect(skill.files[0].content).toContain('Bitmovin CLI');
  });

  it('installs payloads atomically and removes stale files', async () => {
    const [target] = resolveTargets(parseAgents('pi'), skillDirs);
    const staleFile = path.join(target.skillsDir, 'bitmovin-cli', 'old.txt');
    await fs.mkdir(path.dirname(staleFile), {recursive: true});
    await fs.writeFile(staleFile, 'stale');

    await installPayload({name: 'bitmovin-cli', files: [{path: 'SKILL.md', content: '# CLI'}]}, [target]);

    await expect(fs.readFile(path.join(target.skillsDir, 'bitmovin-cli', 'SKILL.md'), 'utf8')).resolves.toBe('# CLI');
    await expect(fs.access(staleFile)).rejects.toThrow();
  });

  it('rejects unsafe payload paths at the installer boundary', async () => {
    const [target] = resolveTargets(parseAgents('pi'), skillDirs);
    await expect(installPayload({
      name: 'bitmovin-cli',
      files: [{path: '../escape', content: 'nope'}],
    }, [target])).rejects.toThrow('Invalid bitmovin-cli file');
    await expect(installPayload({
      name: 'bitmovin-cli',
      files: [{path: 'C:\\escape', content: 'nope'}],
    }, [target])).rejects.toThrow('Invalid bitmovin-cli file');
  });

  it('does not write during dry-run install or remove', async () => {
    const [target] = resolveTargets(parseAgents('pi'), skillDirs);
    await installPayload({name: 'bitmovin-cli', files: [{path: 'SKILL.md', content: '# CLI'}]}, [target], true);
    await expect(fs.access(path.join(target.skillsDir, 'bitmovin-cli'))).rejects.toThrow();

    await fs.mkdir(path.join(target.skillsDir, 'bitmovin-cli'), {recursive: true});
    await removeSkill('bitmovin-cli', [target], true);
    await expect(fs.access(path.join(target.skillsDir, 'bitmovin-cli'))).resolves.toBeUndefined();
  });

  it('discovers skills from repository archives', async () => {
    const archive = await createSkillArchive(tempDir, {
      'skills/bitmovin/SKILL.md': '---\nname: bitmovin\ndescription: Hub skill\n---\n# Bitmovin',
      'skills/bitmovin-player-web/SKILL.md': '---\nname: bitmovin-player-web\ndescription: Web player\n---\n# Web',
    });
    globalThis.fetch = vi.fn(async () => new Response(await fs.readFile(archive), {status: 200})) as typeof fetch;

    const skills = await loadSkills();

    expect(skills).toEqual([
      {name: 'bitmovin', description: 'Hub skill', path: 'skills/bitmovin'},
      {name: 'bitmovin-player-web', description: 'Web player', path: 'skills/bitmovin-player-web', tags: ['player', 'web']},
    ]);
    expect(searchSkills(skills, 'web')).toHaveLength(1);
  });

  it('loads remote skill payloads from repository archives', async () => {
    const archive = await createSkillArchive(tempDir, {
      'skills/bitmovin/SKILL.md': '# Bitmovin',
      'skills/bitmovin/examples/example.txt': 'example',
      'skills/other/SKILL.md': '# Other',
    });
    globalThis.fetch = vi.fn(async () => new Response(await fs.readFile(archive), {status: 200})) as typeof fetch;

    const payload = await loadRemoteSkillPayload({name: 'bitmovin', description: 'Hub', path: 'skills/bitmovin'});

    expect(payload).toEqual({
      name: 'bitmovin',
      files: [
        {path: 'examples/example.txt', content: 'example'},
        {path: 'SKILL.md', content: '# Bitmovin'},
      ],
    });
  });

  it('rejects linked archive entries', async () => {
    const archive = await createSkillArchive(tempDir, {'skills/bitmovin/SKILL.md': '# Bitmovin'}, {symlink: 'skills/bitmovin/link'});
    globalThis.fetch = vi.fn(async () => new Response(await fs.readFile(archive), {status: 200})) as typeof fetch;

    await expect(loadRemoteSkillPayload({name: 'bitmovin', description: 'Hub', path: 'skills/bitmovin'}))
      .rejects.toThrow('links are not allowed');
  });

  it('validates skill definitions before loading remote payloads', async () => {
    await expect(loadRemoteSkillPayload({
      name: 'bitmovin',
      description: 'Hub',
      path: 'other/bitmovin',
    })).rejects.toThrow('Invalid skill path');
  });
});

async function createSkillArchive(tempDir: string, files: Record<string, string>, options: {symlink?: string} = {}): Promise<string> {
  const root = path.join(tempDir, `repo-${Math.random().toString(36).slice(2)}`);
  for (const [file, content] of Object.entries(files)) {
    const output = path.join(root, file);
    await fs.mkdir(path.dirname(output), {recursive: true});
    await fs.writeFile(output, content);
  }

  if (options.symlink) {
    const link = path.join(root, options.symlink);
    await fs.mkdir(path.dirname(link), {recursive: true});
    await fs.symlink('/tmp', link);
  }

  const archive = path.join(tempDir, `${path.basename(root)}.tar.gz`);
  await create({gzip: true, file: archive, cwd: tempDir}, [path.basename(root)]);
  return archive;
}

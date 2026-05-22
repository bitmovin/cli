import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {AgentTarget} from './agents.js';
import {withSkillsArchive} from './archive.js';
import {getRef, validateRelativePath, validateSkillDefinition, validateSkillName, type SkillDefinition} from './source.js';

export type SkillPayload = {
  name: string;
  files: Array<{path: string; content: string}>;
};

export type InstalledSkill = {
  skill: string;
  agent: string;
  path: string;
};

export async function loadRemoteSkillPayload(skill: SkillDefinition, ref?: string): Promise<SkillPayload> {
  return (await loadRemoteSkillPayloads([skill], ref))[0];
}

export async function loadRemoteSkillPayloads(skills: SkillDefinition[], ref?: string): Promise<SkillPayload[]> {
  for (const skill of skills) validateSkillDefinition(skill);
  return withSkillsArchive(getRef(ref), async archiveRoot => loadSkillPayloadsFromArchive(archiveRoot, skills));
}

export async function loadSkillPayloadsFromArchive(archiveRoot: string, skills: SkillDefinition[]): Promise<SkillPayload[]> {
  for (const skill of skills) validateSkillDefinition(skill);
  const payloads: SkillPayload[] = [];
  for (const skill of skills) payloads.push(await loadSkillPayloadFromArchive(archiveRoot, skill));
  return payloads;
}

export async function installPayload(payload: SkillPayload, targets: AgentTarget[], dryRun = false): Promise<InstalledSkill[]> {
  validatePayload(payload);
  const installed: InstalledSkill[] = [];

  for (const target of targets) {
    const destination = path.join(target.skillsDir, payload.name);
    if (!dryRun) {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `bitmovin-skill-${payload.name}-`));
      try {
        for (const file of payload.files) {
          const outputPath = safeJoin(tempDir, file.path);
          await fs.mkdir(path.dirname(outputPath), {recursive: true});
          await fs.writeFile(outputPath, file.content);
        }

        await fs.mkdir(target.skillsDir, {recursive: true});
        await fs.rm(destination, {recursive: true, force: true});
        await fs.cp(tempDir, destination, {recursive: true});
      } finally {
        await fs.rm(tempDir, {recursive: true, force: true});
      }
    }

    installed.push({skill: payload.name, agent: target.agent, path: destination});
  }

  return installed;
}

export async function removeSkill(skillName: string, targets: AgentTarget[], dryRun = false): Promise<InstalledSkill[]> {
  validateSkillName(skillName);
  const removed: InstalledSkill[] = [];
  for (const target of targets) {
    const destination = path.join(target.skillsDir, skillName);
    if (!dryRun) await fs.rm(destination, {recursive: true, force: true});
    removed.push({skill: skillName, agent: target.agent, path: destination});
  }

  return removed;
}

export function validatePayload(payload: SkillPayload): void {
  validateSkillName(payload.name);
  if (!Array.isArray(payload.files) || payload.files.length === 0) {
    throw new Error(`Invalid skill payload: ${payload.name} has no files`);
  }

  for (const file of payload.files) validateRelativePath(file.path, `${payload.name} file`);
}

function safeJoin(root: string, relativePath: string): string {
  validateRelativePath(relativePath, 'payload file');
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, relativePath);
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Invalid payload file: ${relativePath}`);
  }

  return resolvedPath;
}

async function loadSkillPayloadFromArchive(archiveRoot: string, skill: SkillDefinition): Promise<SkillPayload> {
  const skillDir = path.join(archiveRoot, skill.path);
  await assertSkillDirectory(skillDir, skill.name);
  return {name: skill.name, files: await readPayloadFiles(skillDir)};
}

async function assertSkillDirectory(skillDir: string, skillName: string): Promise<void> {
  try {
    await fs.access(path.join(skillDir, 'SKILL.md'));
  } catch {
    throw new Error(`Invalid skills archive: missing skills/${skillName}/SKILL.md`);
  }
}

async function readPayloadFiles(skillDir: string, relativeDir = ''): Promise<SkillPayload['files']> {
  const entries = (await fs.readdir(path.join(skillDir, relativeDir), {withFileTypes: true}))
    .sort((a, b) => a.name.localeCompare(b.name));
  const files: SkillPayload['files'] = [];

  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await readPayloadFiles(skillDir, relativePath));
    } else if (entry.isFile()) {
      validateRelativePath(relativePath, 'archive file');
      files.push({path: relativePath, content: await fs.readFile(safeJoin(skillDir, relativePath), 'utf8')});
    }
  }

  return files;
}

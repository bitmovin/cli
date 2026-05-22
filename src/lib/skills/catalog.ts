import fs from 'node:fs/promises';
import path from 'node:path';
import {withSkillsArchive} from './archive.js';
import {getRef, validateSkillName, type SkillDefinition} from './source.js';

export async function loadSkills(ref?: string): Promise<SkillDefinition[]> {
  return withSkillsArchive(getRef(ref), async archiveRoot => discoverSkills(archiveRoot));
}

export function findSkill(skills: SkillDefinition[], name: string): SkillDefinition {
  const skill = skills.find(candidate => candidate.name === name);
  if (!skill) {
    throw new Error(`Skill not found: ${name}`);
  }

  return skill;
}

export function searchSkills(skills: SkillDefinition[], query: string): SkillDefinition[] {
  const normalized = query.toLowerCase();
  return skills.filter(skill => [
    skill.name,
    skill.description,
    ...(skill.tags ?? []),
  ].some(value => value.toLowerCase().includes(normalized)));
}

export async function discoverSkills(archiveRoot: string): Promise<SkillDefinition[]> {
  const skillsRoot = path.join(archiveRoot, 'skills');
  const entries = (await fs.readdir(skillsRoot, {withFileTypes: true}))
    .filter(entry => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));
  const skills: SkillDefinition[] = [];

  for (const entry of entries) {
    validateSkillName(entry.name);
    const skillPath = `skills/${entry.name}`;
    const skillMarkdownPath = path.join(skillsRoot, entry.name, 'SKILL.md');
    try {
      const markdown = await fs.readFile(skillMarkdownPath, 'utf8');
      skills.push({
        name: extractFrontmatterValue(markdown, 'name') ?? entry.name,
        description: extractDescription(markdown) ?? 'Bitmovin AI assistant skill',
        path: skillPath,
        tags: inferTags(entry.name),
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  return skills;
}

function extractDescription(markdown: string): string | undefined {
  return extractFrontmatterValue(markdown, 'description')
    ?? markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
}

function extractFrontmatterValue(markdown: string, key: string): string | undefined {
  return markdown.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim();
}

function inferTags(name: string): string[] | undefined {
  const tags = name.split('-').filter(part => part !== 'bitmovin');
  return tags.length ? tags : undefined;
}

import path from 'node:path';

export type SkillDefinition = {
  name: string;
  description: string;
  path: string;
  tags?: string[];
};

const SKILLS_OWNER = 'bitmovin';
const SKILLS_REPO = 'skills';
const SKILLS_REPOSITORY = `https://github.com/${SKILLS_OWNER}/${SKILLS_REPO}`;
const DEFAULT_REF = 'main';

export function getRef(ref?: string): string {
  return ref ?? process.env.BITMOVIN_SKILLS_REF ?? DEFAULT_REF;
}

export function archiveUrl(ref: string): string {
  return `${SKILLS_REPOSITORY}/archive/${ref}.tar.gz`;
}

export function validateSkillDefinition(skill: SkillDefinition): void {
  validateSkillName(skill.name);
  if (skill.path !== `skills/${skill.name}`) {
    throw new Error(`Invalid skill path for ${skill.name}: ${skill.path}`);
  }
}

export function validateSkillName(name: string): void {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    throw new Error(`Invalid skill name: ${name}`);
  }
}

export function validateRelativePath(filePath: string, label: string): void {
  const normalized = filePath.replace(/\\/g, '/');
  if (
    !normalized
    || normalized.startsWith('/')
    || normalized.startsWith('//')
    || /^[a-zA-Z]:\//.test(normalized)
    || path.isAbsolute(filePath)
    || normalized.split('/').includes('..')
  ) {
    throw new Error(`Invalid ${label}: ${filePath}`);
  }
}

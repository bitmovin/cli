import {describe, expect, it} from 'vitest';
import {buildSkillsAddArgs, buildSkillsListArgs, buildSkillsRemoveArgs} from '../../src/lib/skills/npx.js';

describe('skills npx wrapper', () => {
  it('builds list args', () => {
    expect(buildSkillsListArgs()).toEqual(['--yes', 'skills@1.5.7', 'add', 'bitmovin/skills', '--list']);
  });

  it('builds add args for the default hub skill', () => {
    expect(buildSkillsAddArgs({agent: 'pi,codex'})).toEqual([
      '--yes', 'skills@1.5.7', 'add', 'bitmovin/skills', '--global', '--copy', '--yes', '--skill', 'bitmovin', '--agent', 'pi', '--agent', 'codex',
    ]);
  });

  it('builds add args for all skills at a ref', () => {
    expect(buildSkillsAddArgs({all: true, ref: 'main'})).toEqual([
      '--yes', 'skills@1.5.7', 'add', 'bitmovin/skills#main', '--global', '--copy', '--yes', '--skill', '*',
    ]);
  });

  it('builds remove args', () => {
    expect(buildSkillsRemoveArgs({skill: 'bitmovin', agent: 'pi,pi'})).toEqual([
      '--yes', 'skills@1.5.7', 'remove', 'bitmovin', '--global', '--yes', '--agent', 'pi',
    ]);
  });
});

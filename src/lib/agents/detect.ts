import {existsSync, statSync} from 'node:fs';
import {homedir} from 'node:os';
import {join, win32, posix} from 'node:path';
import {AGENTS, AGENT_IDS, type AgentId} from './registry.js';

export interface AgentDetection {
  installed: boolean;
  via: 'bin' | 'config-dir' | 'forced' | 'none';
  binPath?: string;
}

export type DetectionMap = Record<AgentId, AgentDetection>;

export interface PathEnv {
  path?: string;
  pathext?: string;
  platform?: NodeJS.Platform;
  exists?: (file: string) => boolean;
}

/** Resolves a binary on PATH without shelling out; honors PATHEXT on win32. */
export function findOnPath(bin: string, env: PathEnv = {}): string | undefined {
  const platform = env.platform ?? process.platform;
  const pathModule = platform === 'win32' ? win32 : posix;
  const pathValue = env.path ?? process.env.PATH ?? '';
  const exists = env.exists ?? (file => existsSync(file) && statSync(file).isFile());
  const extensions = platform === 'win32'
    ? (env.pathext ?? process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean)
    : [''];

  for (const dir of pathValue.split(pathModule.delimiter).filter(Boolean)) {
    for (const ext of extensions) {
      const candidate = pathModule.join(dir, bin + ext);
      if (exists(candidate)) return candidate;
    }
  }

  return undefined;
}

/** Extra locations probed besides PATH, per binary. */
function extraBinCandidates(bin: string, home: string): string[] {
  // The native Claude Code installer places the binary outside PATH-managed dirs.
  if (bin === 'claude') return [join(home, '.claude', 'local', 'claude')];
  return [];
}

export function detectAgents(forced: AgentId[] = []): DetectionMap {
  const home = homedir();
  const map = {} as DetectionMap;

  for (const id of AGENT_IDS) {
    const spec = AGENTS[id];
    let binPath = findOnPath(spec.bin);
    if (!binPath) {
      binPath = extraBinCandidates(spec.bin, home).find(candidate => {
        try {
          return existsSync(candidate) && statSync(candidate).isFile();
        } catch {
          return false;
        }
      });
    }

    if (binPath) {
      map[id] = {installed: true, via: 'bin', binPath};
    } else if (spec.configDirs.some(dir => existsSync(join(home, dir)))) {
      map[id] = {installed: true, via: 'config-dir'};
    } else if (forced.includes(id)) {
      map[id] = {installed: true, via: 'forced'};
    } else {
      map[id] = {installed: false, via: 'none'};
    }
  }

  return map;
}

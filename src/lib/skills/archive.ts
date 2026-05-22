import fs from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {extract} from 'tar';
import {archiveUrl, validateRelativePath} from './source.js';

type TarEntry = {
  path: string;
  type?: string;
};

export async function withSkillsArchive<T>(ref: string, callback: (archiveRoot: string) => Promise<T>): Promise<T> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bitmovin-skills-archive-'));
  try {
    const archivePath = path.join(tempDir, 'archive.tar.gz');
    const extractDir = path.join(tempDir, 'extract');
    await downloadArchive(archiveUrl(ref), archivePath);
    await extractArchive(archivePath, extractDir);
    return callback(await findArchiveRoot(extractDir));
  } finally {
    await fs.rm(tempDir, {recursive: true, force: true});
  }
}

async function downloadArchive(url: string, destination: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to fetch skills archive: ${response.status} ${response.statusText}`);
  }

  await pipeline(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(destination));
}

async function extractArchive(archivePath: string, extractDir: string): Promise<void> {
  await fs.mkdir(extractDir, {recursive: true});
  let invalidArchiveEntry: string | undefined;
  await extract({
    file: archivePath,
    cwd: extractDir,
    preservePaths: false,
    filter: (entryPath, entry) => {
      const result = validateArchiveEntry(entryPath, entry as TarEntry);
      invalidArchiveEntry ??= result.error;
      return !invalidArchiveEntry && result.include;
    },
  });

  if (invalidArchiveEntry) throw new Error(invalidArchiveEntry);
}

function validateArchiveEntry(entryPath: string, entry: TarEntry): {include: boolean; error?: string} {
  try {
    validateRelativePath(entryPath, 'archive entry');
  } catch (error) {
    return {include: false, error: error instanceof Error ? error.message : `Invalid archive entry: ${entryPath}`};
  }

  const parts = entryPath.replace(/\\/g, '/').split('/').filter(Boolean);
  const isArchiveRoot = parts.length === 1;
  const isSkillsEntry = parts[1] === 'skills';
  if (!isArchiveRoot && !isSkillsEntry) return {include: false};

  if (isSkillsEntry && (entry.type === 'SymbolicLink' || entry.type === 'Link')) {
    return {include: false, error: `Invalid skills archive: links are not allowed (${entry.path})`};
  }

  return {include: true};
}

async function findArchiveRoot(extractDir: string): Promise<string> {
  const entries = await fs.readdir(extractDir, {withFileTypes: true});
  const directories = entries.filter(entry => entry.isDirectory());
  if (directories.length !== 1) {
    throw new Error('Invalid skills archive: expected exactly one top-level directory');
  }

  return path.join(extractDir, directories[0].name);
}

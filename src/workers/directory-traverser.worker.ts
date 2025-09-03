import { scopeGitignoreContent, normalizeRel } from '@/lib/gitignore-scope';
import type { Settings } from '@/lib/types';
import ignore from 'ignore';

type TraverseMessage = {
  type: 'traverse-directory';
  payload: {
    rootHandle: FileSystemDirectoryHandle;
    settings: Settings;
  };
};

type ReadProgressMessage = {
  type: 'read-progress';
  payload: {
    processed: number;
    total?: number;
    message: string;
  };
};

type ScanErrorMessage = {
  type: 'read-error';
  payload: string;
};

type FileEntryForReader = {
  path: string;
  handle: FileSystemFileHandle;
};

const joinRel = (base: string, child: string): string => {
  const a = normalizeRel(base);
  const b = normalizeRel(child);
  return a ? `${a}/${b}`.replace(/\/{2,}/g, '/') : b;
};

async function readGitignoreForDir(
  dirHandle: FileSystemDirectoryHandle,
  relDir: string,
): Promise<string[]> {
  try {
    const fh = await dirHandle.getFileHandle('.gitignore');
    const file = await fh.getFile();
    const text = await file.text();
    return scopeGitignoreContent(relDir, text);
  } catch {
    return [];
  }
}

self.onmessage = async (event: MessageEvent<TraverseMessage>) => {
  const { type, payload } = event.data;
  if (type !== 'traverse-directory') return;

  try {
    const { rootHandle } = payload;
    const entriesForReader: FileEntryForReader[] = [];

    const queue: Array<{
      handle: FileSystemDirectoryHandle;
      rel: string; // relative path from the root selection
      patterns: string[]; // accumulated scoped patterns
    }> = [];

    // Root-level patterns from root .gitignore (if any)
    const rootPatterns = await readGitignoreForDir(rootHandle, '');
    queue.push({ handle: rootHandle, rel: '', patterns: rootPatterns });

    let processed = 0;

    while (queue.length > 0) {
      const { handle, rel, patterns } = queue.shift()!;

      // Compile ignore with accumulated patterns
      const ig = ignore();
      ig.add(patterns);

      // Iterate directory entries
      try {
        for await (const entry of handle.values()) {
          try {
            const name = entry.name;
            const relPath = joinRel(rel, name);
            const relForIgnore = normalizeRel(relPath);

            if (entry.kind === 'directory') {
              // If parent rules ignore this directory, skip entire subtree
              const dirTest = relForIgnore.endsWith('/') ? relForIgnore : relForIgnore + '/';
              if (ig.ignores(dirTest)) {
                continue;
              }

              const dirHandle = await handle.getDirectoryHandle(name);
              // Load nested .gitignore for this directory
              const localPatterns = await readGitignoreForDir(dirHandle, relPath);
              const combined = patterns.concat(localPatterns);
              queue.push({ handle: dirHandle, rel: relPath, patterns: combined });
            } else if (entry.kind === 'file') {
              if (ig.ignores(relForIgnore)) {
                continue;
              }

              const fileHandle = await handle.getFileHandle(name);
              entriesForReader.push({ path: relPath, handle: fileHandle });
              processed++;

              if (processed % 25 === 0) {
                const msg: ReadProgressMessage = {
                  type: 'read-progress',
                  payload: {
                    processed,
                    message: `Queued files for reading... (${processed})`,
                  },
                };
                self.postMessage(msg);
              }
            }
          } catch (e) {
            console.error('Error while processing entry:', e);
          }
        }
      } catch (e) {
        console.error('Error while iterating directory:', e);
      }
    }

    // Send results back to main thread for orchestration
    self.postMessage({ type: 'scan-complete', payload: { entries: entriesForReader } });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const err: ScanErrorMessage = { type: 'read-error', payload: errorMessage };
    self.postMessage(err);
  }
};

export { };

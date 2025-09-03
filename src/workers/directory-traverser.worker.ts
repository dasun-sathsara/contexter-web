import { scopeGitignoreContent, normalizeRel } from '@/lib/gitignore-scope';
import type { Settings } from '@/lib/types';
import ignore from 'ignore';

type TraverseMessage = {
  type: 'traverse-directory';
  payload: {
    rootHandle: FileSystemDirectoryHandle;
    settings: Settings;
    readerPort?: MessagePort;
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
  size: number;
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
  } catch (_e) {
    return [];
  }
}

async function isProbablyTextFile(file: File): Promise<boolean> {
  const CHUNK_SIZE = 8000;
  const blob = file.slice(0, CHUNK_SIZE);
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let nonPrintable = 0;
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126)) continue;
    if (byte >= 128) continue;
    nonPrintable++;
  }
  const ratio = nonPrintable / bytes.length;
  return ratio < 0.05;
}

async function isTextFile(file: File): Promise<boolean> {
  if (file.type) {
    const lower = file.type.toLowerCase();
    if (lower.startsWith('text/')) return true;
    if (
      lower.includes('json') ||
      lower.includes('xml') ||
      lower.includes('yaml') ||
      lower.includes('javascript') ||
      lower.includes('typescript') ||
      lower.includes('html') ||
      lower.includes('css') ||
      lower.includes('csv') ||
      lower.includes('markdown')
    ) {
      return true;
    }
    if (
      lower.startsWith('image/') ||
      lower.startsWith('audio/') ||
      lower.startsWith('video/') ||
      lower === 'application/pdf' ||
      lower.startsWith('application/zip') ||
      lower.startsWith('application/x-')
    ) {
      return false;
    }
  }
  return isProbablyTextFile(file);
}

self.onmessage = async (event: MessageEvent<TraverseMessage>) => {
  const { type, payload } = event.data;
  if (type !== 'traverse-directory') return;

  try {
    const { rootHandle, settings, readerPort } = payload;
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
      const anyHandle = handle as any;
      const iterator: AsyncIterable<any> =
        (typeof anyHandle.values === 'function' && anyHandle.values()) ||
        (typeof anyHandle.entries === 'function' && anyHandle.entries()) ||
        (async function* () { })();

      for await (const val of iterator) {
        const entry: FileSystemHandle = Array.isArray(val) ? val[1] : val;
        try {
          const name = entry.name;
          const relPath = joinRel(rel, name);
          const relForIgnore = normalizeRel(relPath); // relative path for ignore()


          if (entry.kind === 'directory') {

            // If parent rules ignore this directory, skip entire subtree
            const dirTest = relForIgnore.endsWith('/')
              ? relForIgnore
              : relForIgnore + '/';
            if (ig.ignores(dirTest)) {
              continue;
            } else {
            }

            const dirHandle = await handle.getDirectoryHandle(name);
            // Load nested .gitignore for this directory
            const localPatterns = await readGitignoreForDir(dirHandle, relPath);
            const combined = patterns.concat(localPatterns);
            queue.push({ handle: dirHandle, rel: relPath, patterns: combined });
          } else if (entry.kind === 'file') {
            if (ig.ignores(relForIgnore)) {
              console.log('Ignoring file:', relForIgnore);
              continue;
            }

            const fileHandle = await handle.getFileHandle(name);
            const file = await fileHandle.getFile();
            if (file.size > settings.maxFileSize) {
              processed++;
              if (processed % 50 === 0) {
                const msg: ReadProgressMessage = {
                  type: 'read-progress',
                  payload: { processed, message: `Scanning files... (${processed})` },
                };
                self.postMessage(msg);
              }
              continue;
            }

            const isText = await isTextFile(file);
            if (!isText) {
              processed++;
              if (processed % 50 === 0) {
                const msg: ReadProgressMessage = {
                  type: 'read-progress',
                  payload: { processed, message: `Scanning files... (${processed})` },
                };
                self.postMessage(msg);
              }
              continue;
            }

            // Do not read content here; defer to reader worker
            entriesForReader.push({ path: relPath, handle: fileHandle, size: file.size });
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
    }

    // Hand off to reader worker if a port was provided
    if (readerPort) {
      readerPort.postMessage({
        type: 'read-handles',
        payload: { entries: entriesForReader },
      });
    } else {
      // If no reader port provided, emit an error so the main thread can handle it
      const err: ScanErrorMessage = { type: 'read-error', payload: 'Reader port not provided.' };
      self.postMessage(err);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const err: ScanErrorMessage = { type: 'read-error', payload: errorMessage };
    self.postMessage(err);
  }
};

export { };

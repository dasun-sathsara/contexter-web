import type { FileInput } from '@/lib/types';
import { FileWithPath } from 'react-dropzone';


interface ReadFilesMessage {
  type: 'read-files';
  payload: {
    files: { file: FileWithPath; path: string }[];
    pathsToRead: string[];
    processingWorkerPort?: MessagePort;
  };
}

interface ConnectPortMessage {
  type: 'connect-port';
  payload: {
    port: MessagePort;
  };
}

interface ReadHandlesMessage {
  type: 'read-handles';
  payload: {
    entries: { path: string; handle: FileSystemFileHandle; size: number }[];
  };
}

interface ReadCompleteMessage {
  type: 'read-complete';
  payload: {
    fileInputs: FileInput[];
    rootFileContents: Map<string, string>;
  };
}

interface ReadProgressMessage {
  type: 'read-progress';
  payload: {
    processed: number;
    total: number;
    message: string;
  };
}

interface ReadErrorMessage {
  type: 'read-error';
  payload: string;
}

/**
 * Heuristic check: determine if a file is likely text by inspecting its first bytes.
 * - Reads up to 8000 bytes
 * - If too many non-printable control characters are found, treat as binary
 */
async function isProbablyTextFile(file: File): Promise<boolean> {
  const CHUNK_SIZE = 8000;
  const blob = file.slice(0, CHUNK_SIZE);
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let nonPrintable = 0;
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    // Allow common whitespace and printable ASCII
    if (
      byte === 9 || // tab
      byte === 10 || // LF
      byte === 13 || // CR
      (byte >= 32 && byte <= 126)
    ) {
      continue;
    }
    // Allow extended UTF-8 (>127) tentatively
    if (byte >= 128) {
      continue;
    }
    nonPrintable++;
  }

  // If more than 5% of bytes are non-printable, assume binary
  const ratio = nonPrintable / bytes.length;
  return ratio < 0.05;
}

/**
 * Decide if a file is text:
 * - Prefer MIME type if available
 * - Otherwise, fall back to byte-level heuristic
 */
async function isTextFile(file: File): Promise<boolean> {
  if (file.type) {
    const lower = file.type.toLowerCase();
    if (lower.startsWith('text/')) {
      return true;
    }
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
    // If MIME type clearly indicates binary (image, audio, video, etc.)
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
    // Otherwise, fall back to heuristic
  }
  return isProbablyTextFile(file);
}

function handleReadFromDroppedFiles(payload: ReadFilesMessage['payload']): Promise<void> {
  return new Promise(async (resolve) => {
    try {
      const { files, pathsToRead } = payload;

      const fileMap = new Map(files.map((f) => [f.path, f.file]));

      const fileInputs: FileInput[] = [];
      const rootFileContents = new Map<string, string>();

      const BATCH_SIZE = 50;
      let processedCount = 0;

      for (let i = 0; i < pathsToRead.length; i += BATCH_SIZE) {
        const batch = pathsToRead.slice(i, i + BATCH_SIZE);

        const batchPromises = batch.map(async (path) => {
          const file = fileMap.get(path);
          if (file) {
            try {
              const isText = await isTextFile(file);
              if (!isText) return;
              const content = await file.text();
              fileInputs.push({ path, content });
              rootFileContents.set(path, content);
            } catch (e) {
              console.warn(`[FileReader Worker] Could not read file: ${path}`, e);
            }
          }
        });

        await Promise.all(batchPromises);
        processedCount += batch.length;

        const progressMessage: ReadProgressMessage = {
          type: 'read-progress',
          payload: {
            processed: processedCount,
            total: pathsToRead.length,
            message: `Reading files... (${processedCount}/${pathsToRead.length})`,
          },
        };
        self.postMessage(progressMessage);
      }

      const result: ReadCompleteMessage = {
        type: 'read-complete',
        payload: { fileInputs, rootFileContents },
      };
      self.postMessage(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[FileReader Worker] Error reading files:', error);
      const errorResult: ReadErrorMessage = { type: 'read-error', payload: errorMessage };
      self.postMessage(errorResult);
    } finally {
      resolve();
    }
  });
}

function handleReadFromHandles(entries: ReadHandlesMessage['payload']['entries']): Promise<void> {
  return new Promise(async (resolve) => {
    try {
      const fileInputs: FileInput[] = [];
      const rootFileContents = new Map<string, string>();
      const total = entries.length;
      let processed = 0;

      const BATCH_SIZE = 50;
      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (entry) => {
            try {
              const file = await entry.handle.getFile();
              const isText = await isTextFile(file);
              if (!isText) return;
              const content = await file.text();
              fileInputs.push({ path: entry.path, content });
              rootFileContents.set(entry.path, content);
            } catch (e) {
              console.warn(`[FileReader Worker] Could not read handle: ${entry.path}`, e);
            }
          }),
        );
        processed += batch.length;
        const progressMessage: ReadProgressMessage = {
          type: 'read-progress',
          payload: {
            processed,
            total,
            message: `Reading files... (${processed}/${total})`,
          },
        };
        self.postMessage(progressMessage);
      }

      const result: ReadCompleteMessage = {
        type: 'read-complete',
        payload: { fileInputs, rootFileContents },
      };
      self.postMessage(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[FileReader Worker] Error reading handles:', error);
      const errorResult: ReadErrorMessage = { type: 'read-error', payload: errorMessage };
      self.postMessage(errorResult);
    } finally {
      resolve();
    }
  });
}

let connectedPort: MessagePort | null = null;

self.onmessage = async (event: MessageEvent<ReadFilesMessage | ConnectPortMessage | ReadHandlesMessage>) => {
  const { type, payload } = event.data as any;

  switch (type) {
    case 'read-files':
      await handleReadFromDroppedFiles((payload as ReadFilesMessage['payload']));
      break;
    case 'connect-port': {
      const { port } = payload as ConnectPortMessage['payload'];
      connectedPort = port;
      connectedPort.onmessage = async (ev: MessageEvent<ReadHandlesMessage>) => {
        if ((ev.data as any)?.type === 'read-handles') {
          const entries = (ev.data as ReadHandlesMessage).payload.entries;
          await handleReadFromHandles(entries);
        }
      };
      // Some browsers require start()
      try {
        connectedPort.start?.();
      } catch { }
      break;
    }
    case 'read-handles': {
      const entries = (payload as ReadHandlesMessage['payload']).entries;
      await handleReadFromHandles(entries);
      break;
    }
    default:
      console.warn('[FileReader Worker] Received unknown message type:', type);
      break;
  }
};

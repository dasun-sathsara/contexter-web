import type { FileInput } from '@/lib/types';
import { FileWithPath } from 'react-dropzone';
import { isTextFile } from '@/lib/textfile-check';
import { normalizeRootRelativePath } from '@/lib/path-utils';


interface ReadFilesMessage {
  type: 'read-files';
  payload: {
    files: { file: FileWithPath; path: string }[];
    pathsToRead: string[];
    processingWorkerPort?: MessagePort;
  };
}

interface ReadHandlesMessage {
  type: 'read-handles';
  payload: {
    entries: { path: string; handle: FileSystemFileHandle }[];
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

function handleReadFromDroppedFiles(payload: ReadFilesMessage['payload']): Promise<void> {
  return new Promise(async (resolve) => {
    try {
      const { files, pathsToRead } = payload;
      const fileMap = new Map(files.map((f) => [normalizeRootRelativePath(f.path), f.file]));

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

self.onmessage = async (event: MessageEvent<ReadFilesMessage | ReadHandlesMessage>) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'read-files':
      await handleReadFromDroppedFiles((payload as ReadFilesMessage['payload']));
      break;
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

import type { FileInput } from '@/lib/types';

type FileWithPath = File & { webkitRelativePath: string };

interface ReadFilesMessage {
  type: 'read-files';
  payload: {
    files: { file: FileWithPath, path: string }[];
    pathsToRead: string[];
    processingWorkerPort?: MessagePort;
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

self.onmessage = async (event: MessageEvent<ReadFilesMessage>) => {
  const { type, payload } = event.data;

  if (type !== 'read-files') {
    console.warn('[FileReader Worker] Received unknown message type:', type);
    return;
  }

  try {
    const { files, pathsToRead } = payload;

    // Remove ./ prefix from paths if present in files
    files.forEach(f => {
      if (f.path.startsWith('./')) {
        f.path = f.path.slice(2);
      }
    });

    console.log('Files:', files);
    console.log('Paths to read:', pathsToRead);

    // Create a map for quick file lookup
    const fileMap = new Map(files.map((f) => [f.path, f.file]));

    const fileInputs: FileInput[] = [];
    const rootFileContents = new Map<string, string>();

    // Read files in batches to avoid overwhelming the worker
    const BATCH_SIZE = 50;
    let processedCount = 0;

    for (let i = 0; i < pathsToRead.length; i += BATCH_SIZE) {
      const batch = pathsToRead.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async (path) => {
        const file = fileMap.get(path);
        if (file) {
          try {
            const content = await file.text();
            // Check for binary content by looking for replacement characters
            if (!content.includes('\uFFFD')) {
              fileInputs.push({ path, content });
              rootFileContents.set(path, content);
            }
          } catch (e) {
            console.warn(`[FileReader Worker] Could not read file: ${path}`, e);
          }
        }
      });

      await Promise.all(batchPromises);
      processedCount += batch.length;

      // Report progress to main thread
      const progressMessage: ReadProgressMessage = {
        type: 'read-progress',
        payload: {
          processed: processedCount,
          total: pathsToRead.length,
          message: `Reading files... (${processedCount}/${pathsToRead.length})`
        }
      };
      self.postMessage(progressMessage);
    }

    // Send results back to main thread
    const result: ReadCompleteMessage = {
      type: 'read-complete',
      payload: {
        fileInputs,
        rootFileContents
      }
    };

    self.postMessage(result);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[FileReader Worker] Error reading files:', error);

    const errorResult: ReadErrorMessage = {
      type: 'read-error',
      payload: errorMessage
    };

    self.postMessage(errorResult);
  }
};

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import { FileNode, FileInput, VimMode, ProcessingResult, Settings, FileMetadata } from '@/lib/types';
import { buildCombinedGitignoreContent } from '@/lib/utils';
import { toast } from 'sonner';
import { FileWithPath } from 'react-dropzone';

enableMapSet();


// --- Worker Management ---

let processingWorker: Worker | null = null;
let readerWorker: Worker | null = null;
let directoryWorker: Worker | null = null;

const getProcessingWorker = (): Worker | null => {
  if (typeof window === 'undefined') return null;
  if (!processingWorker) {
    processingWorker = new Worker(new URL('../workers/file-processor.worker.ts', import.meta.url));
  }
  return processingWorker;
};

const getReaderWorker = (): Worker | null => {
  if (typeof window === 'undefined') return null;
  if (!readerWorker) {
    readerWorker = new Worker(new URL('../workers/file-reader.worker.ts', import.meta.url));
  }
  return readerWorker;
};

const getDirectoryWorker = (): Worker | null => {
  if (typeof window === 'undefined') return null;
  if (!directoryWorker) {
    directoryWorker = new Worker(new URL('../workers/directory-traverser.worker.ts', import.meta.url));
  }
  return directoryWorker;
};


/**
 * Module-level variable to hold File objects between filtering and reading steps.
 * This avoids passing the full File list to/from the worker.
 */
let pendingFiles: FileWithPath[] | null = null;

// --- Store Definition ---
interface FileState {
  fileTree: FileNode[];
  fileMap: Map<string, FileNode>;
  rootFiles: Map<string, string>;
  isLoading: boolean;
  statusMessage: string;
  settings: Settings;
  currentFolderPath: string | null;
  navigationStack: string[];
  vimMode: VimMode;
  selectedPaths: Set<string>;
  cursorPath: string | null;
  visualAnchorPath: string | null;
  previewedFilePath: string | null;

  processDroppedFiles: (files: FileWithPath[]) => Promise<void>;
  reprocessFiles: () => Promise<void>;
  setSettings: (newSettings: Partial<Settings>) => void;
  clearAll: () => void;
  navigateInto: (path: string) => void;
  navigateBack: () => void;
  setCursor: (path: string | null) => void;
  toggleSelection: (path: string) => void;
  setSelection: (paths: Set<string>) => void;
  setVimMode: (mode: VimMode) => void;
  setVisualAnchor: (path: string | null) => void;
  yankToClipboard: (pathsToYank?: Set<string>) => void;
  saveToFile: (pathsToSave?: Set<string>) => void;
  deleteSelected: (pathsToDelete?: Set<string>) => void;
  openPreview: (path: string) => void;
  closePreview: () => void;
  selectFolder: () => Promise<void>;
}

const defaultSettings: Settings = {
  hideEmptyFolders: true,
  showTokenCount: true,
  maxFileSize: 2 * 1024 * 1024,
  keybindingMode: 'standard',
};

export const useFileStore = create<FileState>()(
  persist(
    immer((set, get) => {
      const _readAndProcessFiles = async (pathsToRead: string[]) => {
        if (!pendingFiles) {
          toast.error("An internal error occurred: pending files not found.");
          set({ isLoading: false, statusMessage: 'Error: Could not find files to read.' });
          return;
        }

        if (!Array.isArray(pathsToRead) || pathsToRead.length === 0) {
          toast.error("No files to read.");
          set({ isLoading: false, statusMessage: 'Error: No files to read.' });
          return;
        }

        set({ statusMessage: `Reading ${pathsToRead.length} files...` });

        // Send files to the dedicated reader worker
        getReaderWorker()?.postMessage({
          type: 'read-files',
          payload: {
            files: pendingFiles.map(file => ({ file, path: file.path })),
            pathsToRead: pathsToRead
          }
        });
      };

      // Set up processing worker message handler
      const processingWorkerInstance = getProcessingWorker();

      if (processingWorkerInstance) {
        processingWorkerInstance.onmessage = (event: MessageEvent) => {
          const { type, payload } = event.data;

          switch (type) {
            case 'filter-complete': {
              if (payload && Array.isArray(payload.paths) && payload.paths.length > 0) {
                console.log('Filtered Files to Process:', payload.paths.slice(0, 10));
                _readAndProcessFiles(payload.paths);
              } else {
                toast.error("No files found to process.");
                set({ isLoading: false, statusMessage: 'Error: No files found to process.' });
              }
              break;
            }
            case 'processing-complete': {
              const result = payload as ProcessingResult;
              const fileMap = new Map<string, FileNode>();
              const traverse = (nodes: FileNode[]) => {
                for (const node of nodes) {
                  fileMap.set(node.path, node);
                  if (node.children?.length > 0) traverse(node.children);
                }
              };
              traverse(result.file_tree);

              set(state => {
                state.fileTree = result.file_tree;
                state.fileMap = fileMap;
                state.isLoading = false;
                state.statusMessage = `Processed ${result.total_files} files (${(result.total_size / 1024).toFixed(1)} KB)`;
                state.cursorPath = result.file_tree[0]?.path ?? null;
              });
              toast.success("Project processed successfully!", {
                description: `${result.total_files} files loaded in ${result.processing_time_ms.toFixed(0)}ms.`
              });
              break;
            }
            case 'markdown-result': {
              // Distinguish between copy and save actions
              const toastId = event.data.toastId || undefined;
              const action = event.data.action as 'save' | undefined;

              if (action === 'save') {
                const markdown: string = payload as string;

                const doBlobDownload = () => {
                  try {
                    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'contexter-output.md';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    if (toastId) {
                      toast.success("Saved markdown to file.", { id: toastId });
                    } else {
                      toast.success("Saved markdown to file.");
                    }
                  } catch {
                    if (toastId) {
                      toast.error("Failed to save file.", { id: toastId });
                    } else {
                      toast.error("Failed to save file.");
                    }
                  }
                };

                const saveWithFileSystemAccess = async () => {
                  try {
                    // @ts-expect-error - showSaveFilePicker may not be in TypeScript lib by default
                    if (typeof window.showSaveFilePicker === 'function') {
                      // @ts-expect-error - types not available in TS lib
                      const handle = await window.showSaveFilePicker({
                        suggestedName: 'contexter-output.md',
                        types: [
                          {
                            description: 'Markdown',
                            accept: { 'text/markdown': ['.md'] }
                          }
                        ]
                      });
                      const writable = await handle.createWritable();
                      await writable.write(markdown);
                      await writable.close();
                      if (toastId) {
                        toast.success("Saved markdown to file.", { id: toastId });
                      } else {
                        toast.success("Saved markdown to file.");
                      }
                    } else {
                      doBlobDownload();
                    }
                  } catch (err) {
                    // AbortError is user cancel; treat gently
                    const e = err as unknown as { name?: string; code?: number };
                    if (e && (e.name === 'AbortError' || e.code === 20)) {
                      if (toastId) {
                        toast.info("Save canceled.", { id: toastId });
                      } else {
                        toast.info("Save canceled.");
                      }
                    } else {
                      // On any failure, fallback to blob download
                      doBlobDownload();
                    }
                  }
                };

                // Try File System Access API first, fallback to blob download
                void saveWithFileSystemAccess();
                break;
              }

              // Default behavior: copy to clipboard
              navigator.clipboard.writeText(payload)
                .then(() => {
                  if (toastId) {
                    toast.success("Copied to clipboard!", { id: toastId });
                  } else {
                    toast.success("Copied to clipboard!");
                  }
                })
                .catch(() => {
                  if (toastId) {
                    toast.error("Failed to copy to clipboard.", { id: toastId });
                  } else {
                    toast.error("Failed to copy to clipboard.");
                  }
                });
              break;
            }
            case 'recalculation-complete': {
              const { fileTree: recalculatedTree } = payload;
              const newFileMap = new Map<string, FileNode>();
              const traverse = (nodes: FileNode[]) => {
                for (const node of nodes) {
                  newFileMap.set(node.path, node);
                  if (node.children?.length > 0) traverse(node.children);
                }
              };
              traverse(recalculatedTree);

              set({
                fileTree: recalculatedTree,
                fileMap: newFileMap,
                statusMessage: 'Project totals updated.',
              });
              break;
            }
            case 'processing-error': {
              set({ isLoading: false, statusMessage: `Error: ${payload}` });
              toast.error("An error occurred during processing.", { description: payload });
              break;
            }
          }
        };
      }

      // Set up reader worker message handler
      const readerWorkerInstance = getReaderWorker();
      if (readerWorkerInstance) {
        readerWorkerInstance.onmessage = (event: MessageEvent) => {
          const { type, payload } = event.data;

          switch (type) {
            case 'read-progress': {
              set({ statusMessage: payload.message });
              break;
            }
            case 'read-complete': {
              const { fileInputs, rootFileContents } = payload;

              // Store the file contents
              set({
                rootFiles: rootFileContents,
                statusMessage: `Processing ${fileInputs.length} text files...`
              });

              // Clear pending files as they're no longer needed
              pendingFiles = null;

              // Send files to processing worker
              getProcessingWorker()?.postMessage({
                type: 'process-files',
                payload: { files: fileInputs, settings: get().settings }
              });
              break;
            }
            case 'read-error': {
              set({ isLoading: false, statusMessage: `Error: ${payload}` });
              toast.error("An error occurred while reading files.", { description: payload });
              pendingFiles = null;
              break;
            }
          }
        };
      }

      // Set up directory traverser worker message handler
      const directoryWorkerInstance = getDirectoryWorker();
      if (directoryWorkerInstance) {
        directoryWorkerInstance.onmessage = (event: MessageEvent) => {
          const { type, payload } = event.data as { type: string; payload: any };
          switch (type) {
            case 'read-progress': {
              set({ statusMessage: payload.message });
              break;
            }
            case 'read-error': {
              set({ isLoading: false, statusMessage: `Error: ${payload}` });
              toast.error("An error occurred while reading files.", { description: payload });
              break;
            }
          }
        };
      }

      return {
        fileTree: [],
        fileMap: new Map(),
        rootFiles: new Map(),
        isLoading: false,
        statusMessage: 'Ready. Drop a folder to get started.',
        settings: defaultSettings,
        currentFolderPath: null,
        navigationStack: [],
        vimMode: 'normal',
        selectedPaths: new Set(),
        cursorPath: null,
        visualAnchorPath: null,
        previewedFilePath: null,

        processDroppedFiles: async (files: FileWithPath[]) => {
          if (!files || files.length === 0) return;

          set({ isLoading: true, statusMessage: 'Analyzing project structure...', fileTree: [], fileMap: new Map() });
          pendingFiles = files;

          const gitignoreContent = await buildCombinedGitignoreContent(
            files,
          );

          const metadata: FileMetadata[] = files.map((f) => ({ path: f.path!, size: f.size }));

          getProcessingWorker()?.postMessage({
            type: 'filter-files',
            payload: { metadata, gitignoreContent, settings: get().settings }
          });
        },

        reprocessFiles: async () => {
          const { rootFiles, settings } = get();
          if (rootFiles.size === 0) return;
          set({ isLoading: true, statusMessage: 'Re-processing with new settings...' });
          const fileInputs = Array.from(rootFiles.entries()).map(([path, content]) => ({ path, content }));
          getProcessingWorker()?.postMessage({ type: 'process-files', payload: { files: fileInputs, settings } });
        },

        setSettings: (newSettings) => {
          const oldSettings = get().settings;
          const updatedSettings = { ...oldSettings, ...newSettings };

          if (JSON.stringify(oldSettings) !== JSON.stringify(updatedSettings)) {
            set(state => {
              state.settings = updatedSettings;
              if (oldSettings.keybindingMode !== updatedSettings.keybindingMode) {
                state.vimMode = 'normal';
                state.selectedPaths.clear();
                state.visualAnchorPath = null;
                toast.info(`Keybindings set to ${updatedSettings.keybindingMode === 'vim' ? 'VIM' : 'Standard'}.`);
              }
            });

            if (get().fileTree.length > 0) {
              const needsReprocessing = oldSettings.hideEmptyFolders !== updatedSettings.hideEmptyFolders ||
                oldSettings.showTokenCount !== updatedSettings.showTokenCount;
              if (needsReprocessing) {
                get().reprocessFiles();
              }
            }
          }
        },

        clearAll: () => {
          set({
            fileTree: [], fileMap: new Map(), rootFiles: new Map(),
            isLoading: false, statusMessage: 'Ready. Drop a folder to get started.',
            currentFolderPath: null, navigationStack: [], selectedPaths: new Set(),
            cursorPath: null, vimMode: 'normal', visualAnchorPath: null,
            previewedFilePath: null,
          });
          toast.info("Project cleared.");
        },

        navigateInto: (path) => {
          if (get().fileMap.get(path)?.is_dir) {
            set(state => {
              state.navigationStack.push(state.currentFolderPath || 'root');
              state.currentFolderPath = path;
              const currentFolder = state.fileMap.get(path);
              const children = currentFolder?.children || [];
              state.cursorPath = children.length > 0 ? children[0].path : '..';
            });
          }
        },

        navigateBack: () => {
          if (get().navigationStack.length > 0) {
            set(state => {
              const previousPath = state.currentFolderPath;
              const newCurrent = state.navigationStack.pop()!;
              state.currentFolderPath = newCurrent === 'root' ? null : newCurrent;
              state.cursorPath = previousPath;
            });
          }
        },

        setCursor: (path) => set({ cursorPath: path }),
        toggleSelection: (path) => {
          set(state => {
            if (state.selectedPaths.has(path)) {
              state.selectedPaths.delete(path);
            } else {
              state.selectedPaths.add(path);
            }
          });
        },
        setSelection: (paths) => set({ selectedPaths: new Set(paths) }),
        setVimMode: (mode) => {
          if (mode === 'visual' && get().cursorPath) {
            set({ vimMode: 'visual', visualAnchorPath: get().cursorPath, selectedPaths: new Set([get().cursorPath!]) });
          } else {
            set({ vimMode: 'normal', visualAnchorPath: null, selectedPaths: new Set() });
          }
        },
        setVisualAnchor: (path) => set({ visualAnchorPath: path }),

        yankToClipboard: (pathsToYank) => {
          const paths = pathsToYank || get().selectedPaths;
          if (paths.size === 0) return;

          const filesToMerge: FileInput[] = [];
          const collectFiles = (path: string) => {
            const node = get().fileMap.get(path);

            if (!node) return;
            if (node.is_dir) node.children.forEach(child => collectFiles(child.path));
            else {
              const content = get().rootFiles.get(path);
              if (content) filesToMerge.push({ path, content });
            }
          };
          paths.forEach(collectFiles);

          if (filesToMerge.length === 0) {
            toast.warning("No files to copy.");
            return;
          }
          // Use a single toast that updates after completion
          const toastId = `copy-files-${Date.now()}`;
          toast.loading(`Copying ${filesToMerge.length} files...`, { id: toastId });
          getProcessingWorker()?.postMessage({
            type: 'merge-files',
            payload: { files: filesToMerge, options: { includePathHeaders: true }, toastId }
          });
        },

        saveToFile: (pathsToSave) => {
          // Determine paths: explicit set, else selected, else cursor
          let paths = pathsToSave || get().selectedPaths;
          if ((paths?.size ?? 0) === 0) {
            const cursor = get().cursorPath;
            if (cursor && cursor !== '..') {
              paths = new Set([cursor]);
            } else {
              toast.warning("Nothing to save.");
              return;
            }
          }

          const filesToMerge: FileInput[] = [];
          const collectFiles = (path: string) => {
            const node = get().fileMap.get(path);
            if (!node) return;
            if (node.is_dir) node.children.forEach(child => collectFiles(child.path));
            else {
              const content = get().rootFiles.get(path);
              if (content) filesToMerge.push({ path, content });
            }
          };
          paths.forEach(collectFiles);

          if (filesToMerge.length === 0) {
            toast.warning("No files to save.");
            return;
          }

          const toastId = `save-files-${Date.now()}`;
          toast.loading(`Preparing ${filesToMerge.length} files for save...`, { id: toastId });
          getProcessingWorker()?.postMessage({
            type: 'merge-files',
            payload: { files: filesToMerge, options: { includePathHeaders: true }, toastId, action: 'save' }
          });
        },

        deleteSelected: (pathsToDelete) => {
          const paths = pathsToDelete || get().selectedPaths;
          if (paths.size === 0) return;

          set(state => {
            const allPathsToDelete = new Set<string>();
            const collectPaths = (path: string) => {
              if (allPathsToDelete.has(path)) return;
              const node = state.fileMap.get(path);
              if (!node) return;
              allPathsToDelete.add(path);
              if (node.is_dir) {
                node.children.forEach(child => collectPaths(child.path));
              }
            };
            paths.forEach(p => collectPaths(p));

            const view = state.currentFolderPath
              ? state.fileMap.get(state.currentFolderPath)?.children ?? []
              : state.fileTree;
            const cursorIdx = view.findIndex(item => item.path === state.cursorPath);
            const remaining = view.filter(item => !allPathsToDelete.has(item.path));
            state.cursorPath = remaining.length > 0
              ? remaining[Math.min(cursorIdx, remaining.length - 1)].path
              : (state.currentFolderPath ? '..' : null);

            allPathsToDelete.forEach(path => {
              state.rootFiles.delete(path);
            });

            const filterAndResetTree = (nodes: FileNode[]): FileNode[] => {
              return nodes
                .filter(n => !allPathsToDelete.has(n.path))
                .map(n => {
                  const children = n.is_dir ? filterAndResetTree(n.children) : [];
                  return {
                    ...n,
                    token_count: n.is_dir ? undefined : n.token_count,
                    size: n.is_dir ? undefined : n.size,
                    children,
                  };
                });
            };
            state.fileTree = filterAndResetTree(state.fileTree);

            const newFileMap = new Map<string, FileNode>();
            const traverseAndPopulateMap = (nodes: FileNode[]) => {
              for (const node of nodes) {
                newFileMap.set(node.path, node);
                if (node.children?.length > 0) {
                  traverseAndPopulateMap(node.children);
                }
              }
            };
            traverseAndPopulateMap(state.fileTree);
            state.fileMap = newFileMap;

            state.selectedPaths.clear();
            state.vimMode = 'normal';
            state.visualAnchorPath = null;
            state.statusMessage = `Deleted ${allPathsToDelete.size} items. Recalculating totals...`;
            toast.success(`Deleted ${allPathsToDelete.size} items.`);
          });

          const { fileTree, settings } = get();
          if (fileTree.length > 0) {
            getProcessingWorker()?.postMessage({
              type: 'recalculate-counts',
              payload: { fileTree, settings }
            });
          }
        },

        openPreview: (path) => {
          const node = get().fileMap.get(path);
          if (node && !node.is_dir && get().rootFiles.has(path)) {
            set({ previewedFilePath: path });
          } else {
            toast.error("Cannot preview file", { description: "File content not available or it's a directory." });
          }
        },
        closePreview: () => set({ previewedFilePath: null }),

        selectFolder: async () => {
          try {
            if (typeof (window as any).showDirectoryPicker !== 'function') {
              toast.error('Folder selection not supported in this browser.');
              return;
            }
            set({ isLoading: true, statusMessage: 'Selecting folder...', fileTree: [], fileMap: new Map() });
            const handle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
            set({ statusMessage: 'Scanning project files...' });

            // Bridge directory worker to reader worker via MessageChannel
            const rw = getReaderWorker();
            const dw = getDirectoryWorker();
            if (!rw || !dw) {
              set({ isLoading: false, statusMessage: 'Error: Workers not available.' });
              toast.error('Failed to initialize workers.');
              return;
            }
            const channel = new MessageChannel();
            rw.postMessage({ type: 'connect-port', payload: { port: channel.port1 } }, [channel.port1]);
            dw.postMessage({
              type: 'traverse-directory',
              payload: { rootHandle: handle, settings: get().settings, readerPort: channel.port2 }
            }, [channel.port2]);
          } catch (err) {
            const e = err as { name?: string };
            if (e && e.name === 'AbortError') {
              set({ isLoading: false, statusMessage: 'Ready. Drop a folder to get started.' });
              toast.info('Folder selection canceled.');
              return;
            }
            set({ isLoading: false, statusMessage: 'Error: Failed to open folder.' });
            toast.error('Failed to open folder.');
          }
        },
      };
    }),
    {
      name: 'contexter-file-store-v2',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    processingWorker?.terminate();
    readerWorker?.terminate();
  });
}

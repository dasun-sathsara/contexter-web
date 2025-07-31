import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import { FileNode, VimMode, FileInput, ProcessingResult, Settings, FileMetadata } from '@/lib/types';
import { toast } from 'sonner';

enableMapSet();

// A non-standard property provided by browsers for directory uploads.
type FileWithPath = File & { webkitRelativePath: string };

// --- Worker Management ---

let worker: Worker | null = null;
const getWorker = (): Worker | null => {
    if (typeof window === 'undefined') return null;
    if (!worker) {
        // The `new URL(...)` syntax is the modern, standard way to instantiate workers.
        worker = new Worker(new URL('../workers/file-processor.worker.ts', import.meta.url));
    }
    return worker;
};

/**
 * A module-level variable to hold the array of File objects between the
 * initial filtering and the file reading steps. This avoids passing the full
 * File list to/from the worker, improving performance.
 */
let pendingFiles: FileWithPath[] | null = null;

// --- Store Definition ---

interface FileState {
    // Core Data
    fileTree: FileNode[];
    fileMap: Map<string, FileNode>;
    rootFiles: Map<string, string>; // Maps file path to its content

    // UI & Processing State
    isLoading: boolean;
    statusMessage: string;
    settings: Settings;

    // Navigation
    currentFolderPath: string | null;
    navigationStack: string[];

    // Selection & Vim
    vimMode: VimMode;
    selectedPaths: Set<string>;
    cursorPath: string | null;
    visualAnchorPath: string | null;

    // Actions
    processFiles: (files: File[]) => Promise<void>;
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
    deleteSelected: (pathsToDelete?: Set<string>) => void;
}

const defaultSettings: Settings = {
    hideEmptyFolders: true,
    showTokenCount: true,
    maxFileSize: 2 * 1024 * 1024, // 2MB
};

export const useFileStore = create<FileState>()(
    persist(
        immer((set, get) => {
            // Internal helper to read file contents after filtering.
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

                const fileMap = new Map(pendingFiles.map((f) => [f.webkitRelativePath, f]));
                const fileInputs: FileInput[] = [];
                const rootFileContents = new Map<string, string>();

                const readPromises = pathsToRead.map(async (path) => {
                    const file = fileMap.get(path);
                    if (file) {
                        try {
                            const content = await file.text();
                            // Basic check for binary files.
                            if (!content.includes('\uFFFD')) { // REPLACEMENT CHARACTER
                                fileInputs.push({ path, content });
                                rootFileContents.set(path, content);
                            }
                        } catch (e) {
                            console.warn(`Could not read file: ${path}`, e);
                        }
                    }
                });

                await Promise.all(readPromises);
                set({ rootFiles: rootFileContents, statusMessage: `Processing ${fileInputs.length} text files...` });
                pendingFiles = null; // Clean up temporary state

                getWorker()?.postMessage({
                    type: 'process-files',
                    payload: { files: fileInputs, settings: get().settings }
                });
            };

            // Setup worker listeners once when the store is created.
            const workerInstance = getWorker();
            if (workerInstance) {
                workerInstance.onmessage = (event: MessageEvent) => {
                    const { type, payload } = event.data;

                    switch (type) {
                        case 'filter-complete': {
                            console.log('[Store] Filter complete, received:', payload);
                            if (payload && Array.isArray(payload.paths) && payload.paths.length > 0) {
                                console.log('[Store] Found', payload.paths.length, 'files to read');
                                _readAndProcessFiles(payload.paths);
                            } else {
                                console.log('[Store] No files found after filtering');
                                toast.error("No files found to process.");
                                set({ isLoading: false, statusMessage: 'Error: No files found to process.' });
                            }
                            break;
                        }
                        case 'processing-complete': {
                            console.log('[Store] Processing complete, received:', payload);
                            const result = payload as ProcessingResult;
                            const fileMap = new Map<string, FileNode>();
                            const traverse = (nodes: FileNode[]) => {
                                for (const node of nodes) {
                                    fileMap.set(node.path, node);
                                    if (node.children?.length > 0) traverse(node.children);
                                }
                            };
                            traverse(result.file_tree);
                            console.log('[Store] Built file map with', fileMap.size, 'entries');
                            console.log('[Store] File tree root has', result.file_tree.length, 'items');

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
                            navigator.clipboard.writeText(payload)
                                .then(() => toast.success("Copied to clipboard!"))
                                .catch(() => toast.error("Failed to copy to clipboard."));
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

            return {
                // --- Initial State ---
                fileTree: [], fileMap: new Map(), rootFiles: new Map(),
                isLoading: false, statusMessage: 'Ready. Drop a folder to get started.',
                settings: defaultSettings, currentFolderPath: null, navigationStack: [],
                vimMode: 'normal', selectedPaths: new Set(), cursorPath: null, visualAnchorPath: null,

                // --- Actions ---
                processFiles: async (files: File[]) => {
                    console.log('[Store] processFiles called with:', files);
                    if (!files || files.length === 0) return;

                    set({ isLoading: true, statusMessage: 'Analyzing project structure...', fileTree: [], fileMap: new Map() });

                    const filesWithPath = files as FileWithPath[];
                    console.log('[Store] Files with path:', filesWithPath.length, 'files');
                    const firstPath = filesWithPath[0]?.webkitRelativePath;
                    console.log('[Store] First file path:', firstPath);

                    if (!firstPath) {
                        toast.error("Could not process files.", { description: "The dropped items don't appear to be a folder." });
                        set({ isLoading: false, statusMessage: 'Error: Not a valid folder.' });
                        return;
                    }

                    pendingFiles = filesWithPath;

                    const gitignoreFile = filesWithPath.find((f) => f.webkitRelativePath.endsWith('.gitignore'));
                    const gitignoreContent = gitignoreFile ? await gitignoreFile.text() : '';
                    const rootPrefix = firstPath.substring(0, firstPath.indexOf('/') + 1);
                    console.log('[Store] Root prefix:', rootPrefix);

                    const metadata: FileMetadata[] = filesWithPath.map((f) => ({ path: f.webkitRelativePath, size: f.size }));
                    console.log('[Store] Metadata for', metadata.length, 'files, sending to worker');

                    getWorker()?.postMessage({
                        type: 'filter-files',
                        payload: { metadata, gitignoreContent, rootPrefix, settings: get().settings }
                    });
                },

                reprocessFiles: async () => {
                    const { rootFiles, settings } = get();
                    if (rootFiles.size === 0) return;
                    set({ isLoading: true, statusMessage: 'Re-processing with new settings...' });
                    const fileInputs = Array.from(rootFiles.entries()).map(([path, content]) => ({ path, content }));
                    getWorker()?.postMessage({ type: 'process-files', payload: { files: fileInputs, settings } });
                },

                setSettings: (newSettings) => {
                    const oldSettings = get().settings;
                    const updatedSettings = { ...oldSettings, ...newSettings };
                    if (JSON.stringify(oldSettings) !== JSON.stringify(updatedSettings)) {
                        set({ settings: updatedSettings });
                        if (get().fileTree.length > 0) get().reprocessFiles();
                    }
                },

                clearAll: () => {
                    set({
                        fileTree: [], fileMap: new Map(), rootFiles: new Map(),
                        isLoading: false, statusMessage: 'Ready. Drop a folder to get started.',
                        currentFolderPath: null, navigationStack: [], selectedPaths: new Set(),
                        cursorPath: null, vimMode: 'normal', visualAnchorPath: null,
                    });
                    toast.info("Project cleared.");
                },

                navigateInto: (path) => {
                    if (get().fileMap.get(path)?.is_dir) {
                        set(state => {
                            state.navigationStack.push(state.currentFolderPath || 'root');
                            state.currentFolderPath = path;
                            state.cursorPath = '..'; // For intuitive navigation
                        });
                    }
                },

                navigateBack: () => {
                    if (get().navigationStack.length > 0) {
                        set(state => {
                            const previousPath = state.currentFolderPath;
                            const newCurrent = state.navigationStack.pop()!;
                            state.currentFolderPath = newCurrent === 'root' ? null : newCurrent;
                            state.cursorPath = previousPath; // Set cursor on the folder we left
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
                    toast.info(`Copying ${filesToMerge.length} files...`);
                    getWorker()?.postMessage({
                        type: 'merge-files',
                        payload: { files: filesToMerge, options: { includePathHeaders: true } }
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
                            if (node.is_dir) node.children.forEach(child => collectPaths(child.path));
                        };
                        paths.forEach(p => collectPaths(p));

                        // Smart cursor placement
                        const view = state.currentFolderPath ? state.fileMap.get(state.currentFolderPath)?.children ?? [] : state.fileTree;
                        const cursorIdx = view.findIndex(item => item.path === state.cursorPath);
                        const remaining = view.filter(item => !allPathsToDelete.has(item.path));
                        state.cursorPath = remaining.length > 0 ? remaining[Math.min(cursorIdx, remaining.length - 1)].path : (state.currentFolderPath ? '..' : null);

                        // Mutate state
                        allPathsToDelete.forEach(path => {
                            state.fileMap.delete(path);
                            state.rootFiles.delete(path);
                        });

                        // Rebuild tree structure. Note: Parent stats will be stale until re-process.
                        const filterTree = (nodes: FileNode[]): FileNode[] => {
                            return nodes.filter(n => !allPathsToDelete.has(n.path)).map(n => ({
                                ...n,
                                children: n.is_dir ? filterTree(n.children) : [],
                            }));
                        };
                        state.fileTree = filterTree(state.fileTree);

                        state.selectedPaths.clear();
                        state.vimMode = 'normal';
                        state.statusMessage = `Deleted ${allPathsToDelete.size} items.`;
                        toast.success(`Deleted ${allPathsToDelete.size} items.`);
                    });
                },
            };
        }),
        {
            name: 'contexter-file-store-v2', // Changed name to avoid conflicts with old state
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ settings: state.settings }),
        }
    )
);

if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => worker?.terminate());
}

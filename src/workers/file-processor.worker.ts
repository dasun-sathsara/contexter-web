import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import { FileNode, VimMode, FileInput, ProcessingResult, Settings } from '@/lib/types';
import { toast } from 'sonner';

enableMapSet();
// Extend File to include webkitRelativePath provided by directory input
type FileWithPath = File & { webkitRelativePath: string };

// --- Worker Management ---

let worker: Worker | null = null;
const getWorker = () => {
    if (typeof window === 'undefined') return null;
    if (!worker) {
        worker = new Worker(new URL('../workers/file-processor.worker.ts', import.meta.url));
    }
    return worker;
};

// This state is kept at the module level, private to the store's implementation.
// It bridges the gap between the `processFiles` call and the worker's async response.
let pendingFiles: FileWithPath[] | null = null;

// --- Store Definition ---

interface FileState {
    // Core Data
    fileTree: FileNode[];
    fileMap: Map<string, FileNode>;
    rootFiles: Map<string, string>; // path -> content

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
};

export const useFileStore = create<FileState>()(
    persist(
        immer((set, get) => {
            // This is an internal helper function, not part of the public store API.
            const _readAndProcessFiles = async (pathsToRead: string[]) => {
                if (!pendingFiles) {
                    toast.error("An internal error occurred: pending files not found.");
                    set({ isLoading: false, statusMessage: 'Error: Could not find files to read.' });
                    return;
                }

                set({ statusMessage: `Reading ${pathsToRead.length} files...` });

                const fileMap = new Map(pendingFiles.map((f: FileWithPath) => [f.webkitRelativePath, f]));
                const fileInputs: FileInput[] = [];
                const rootFileContents = new Map<string, string>();

                const readPromises = pathsToRead.map(async (path) => {
                    const file = fileMap.get(path);
                    if (file) {
                        try {
                            const content = await file.text();
                            // Basic check to ensure we're not reading a binary file that slipped through
                            if (!content.includes('\uFFFD')) {
                                fileInputs.push({ path, content });
                                rootFileContents.set(path, content);
                            } else {
                                console.warn(`Skipping file with invalid characters (likely binary): ${path}`);
                            }
                        } catch {
                            console.warn(`Could not read file: ${path}`);
                        }
                    }
                });

                await Promise.all(readPromises);
                set({ rootFiles: rootFileContents, statusMessage: `Processing ${fileInputs.length} files...` });

                // Clean up the temporary state
                pendingFiles = null;

                getWorker()?.postMessage({
                    type: 'process-files',
                    payload: { files: fileInputs, settings: get().settings }
                });
            };

            // Setup worker listeners once
            const workerInstance = getWorker();
            if (workerInstance) {
                workerInstance.onmessage = (event: MessageEvent) => {
                    const { type, payload } = event.data;

                    switch (type) {
                        case 'filter-complete': {
                            const { paths } = payload;
                            // Call the internal helper function
                            _readAndProcessFiles(paths);
                            break;
                        }
                        case 'processing-complete': {
                            const result = payload as ProcessingResult;
                            const fileMap = new Map<string, FileNode>();
                            const traverse = (nodes: FileNode[]) => {
                                for (const node of nodes) {
                                    fileMap.set(node.path, node);
                                    if (node.children.length > 0) traverse(node.children);
                                }
                            };
                            traverse(result.file_tree);

                            set(state => {
                                state.fileTree = result.file_tree;
                                state.fileMap = fileMap;
                                state.isLoading = false;
                                // THIS LINE IS FIXED
                                state.statusMessage = `Processed ${result.total_files} files (${((result.total_size ?? 0) / 1024).toFixed(1)} KB)`;
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
                // Initial State
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

                // --- Actions ---

                processFiles: async (files: FileWithPath[]) => {
                    if (files.length === 0) return;

                    set({ isLoading: true, statusMessage: 'Analyzing project structure...' });

                    const gitignoreFile = (files as FileWithPath[]).find(f => f.webkitRelativePath.endsWith('.gitignore'));
                    const gitignoreContent = gitignoreFile ? await gitignoreFile.text() : '';
                    const firstPath = (files as FileWithPath[])[0]?.webkitRelativePath || '';
                    const rootPrefix = firstPath.substring(0, firstPath.indexOf('/') + 1);

                    const metadata = files.map((f: FileWithPath) => ({
                        path: f.webkitRelativePath,
                        size: f.size
                    }));

                    // Use the private module-level variable to store files temporarily
                    pendingFiles = files;

                    getWorker()?.postMessage({
                        type: 'filter-files',
                        payload: { metadata, gitignoreContent, rootPrefix, settings: get().settings }
                    });
                },

                reprocessFiles: async () => {
                    const { rootFiles, settings } = get();
                    if (rootFiles.size === 0) return;
                    set({ isLoading: true, statusMessage: 'Re-processing files...' });

                    const fileInputs = Array.from(rootFiles.entries()).map(([path, content]) => ({ path, content }));

                    getWorker()?.postMessage({
                        type: 'process-files',
                        payload: { files: fileInputs, settings }
                    });
                },

                setSettings: (newSettings) => {
                    const oldSettings = get().settings;
                    set(state => {
                        state.settings = { ...state.settings, ...newSettings };
                    });

                    if (get().fileTree.length > 0 && JSON.stringify(oldSettings) !== JSON.stringify(get().settings)) {
                        get().reprocessFiles();
                    }
                },

                clearAll: () => {
                    set({
                        fileTree: [],
                        fileMap: new Map(),
                        rootFiles: new Map(),
                        isLoading: false,
                        statusMessage: 'Ready. Drop a folder to get started.',
                        currentFolderPath: null,
                        navigationStack: [],
                        selectedPaths: new Set(),
                        cursorPath: null,
                    });
                    toast.info("Project cleared.");
                },

                navigateInto: (path) => {
                    const node = get().fileMap.get(path);
                    if (node?.is_dir) {
                        set(state => {
                            state.navigationStack.push(state.currentFolderPath || 'root');
                            state.currentFolderPath = path;
                            state.cursorPath = '..';
                        });
                    }
                },

                navigateBack: () => {
                    const { navigationStack } = get();
                    if (navigationStack.length > 0) {
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
                setVimMode: (mode) => set({ vimMode: mode, visualAnchorPath: mode === 'normal' ? null : get().cursorPath }),
                setVisualAnchor: (path) => set({ visualAnchorPath: path }),

                yankToClipboard: (pathsToYank) => {
                    const { selectedPaths, fileMap, rootFiles } = get();
                    const paths = pathsToYank || selectedPaths;
                    if (paths.size === 0) return;

                    const filesToMerge: FileInput[] = [];
                    const collectFiles = (path: string) => {
                        const node = fileMap.get(path);
                        if (!node) return;
                        if (!node.is_dir) {
                            const content = rootFiles.get(path);
                            if (content) filesToMerge.push({ path, content });
                        } else {
                            node.children.forEach(child => collectFiles(child.path));
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
                        payload: { files: filesToMerge, options: {} }
                    });
                },

                deleteSelected: (pathsToDelete) => {
                    const { fileMap, rootFiles } = get();
                    const paths = pathsToDelete || get().selectedPaths;
                    if (paths.size === 0) return;

                    set(state => {
                        const allPathsToDelete = new Set<string>();
                        const parentsToUpdate = new Map<string, { tokenDelta: number, sizeDelta: number }>();

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

                        // Determine cursor's next position before mutation
                        const currentView = state.currentFolderPath
                            ? state.fileMap.get(state.currentFolderPath)?.children ?? []
                            : state.fileTree;
                        const cursorIdx = currentView.findIndex(item => item.path === state.cursorPath);
                        const remainingView = currentView.filter(item => !allPathsToDelete.has(item.path));
                        let nextCursorPath: string | null = null;
                        if (remainingView.length > 0) {
                            nextCursorPath = remainingView[Math.min(cursorIdx, remainingView.length - 1)].path;
                        } else if (state.currentFolderPath) {
                            nextCursorPath = '..';
                        }
                        state.cursorPath = nextCursorPath;

                        // Delete nodes and prepare parent updates
                        allPathsToDelete.forEach(path => {
                            const node = state.fileMap.get(path);
                            if (!node) return;

                            const parentPath = node.path.substring(0, node.path.lastIndexOf('/'));
                            if (state.fileMap.has(parentPath)) {
                                const update = parentsToUpdate.get(parentPath) || { tokenDelta: 0, sizeDelta: 0 };
                                update.tokenDelta -= node.token_count || 0;
                                update.sizeDelta -= node.size || 0;
                                parentsToUpdate.set(parentPath, update);
                            }

                            state.fileMap.delete(path);
                            if (!node.is_dir) state.rootFiles.delete(path);
                        });

                        // Update tree structure and parent stats
                        const updateParents = (node: FileNode) => {
                            node.children = node.children.filter(child => !allPathsToDelete.has(child.path));
                            if (parentsToUpdate.has(node.path)) {
                                const delta = parentsToUpdate.get(node.path)!;
                                if (node.token_count) node.token_count += delta.tokenDelta;
                                if (node.size) node.size += delta.sizeDelta;
                            }
                            node.children.forEach(updateParents);
                        };
                        state.fileTree.forEach(updateParents);
                        state.fileTree = state.fileTree.filter(node => !allPathsToDelete.has(node.path));

                        state.selectedPaths.clear();
                        state.vimMode = 'normal';
                        state.statusMessage = `Deleted ${allPathsToDelete.size} items.`;
                        toast.success(`Deleted ${allPathsToDelete.size} items.`);
                    });
                },
            };
        }),
        {
            name: 'contexter-file-store',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ settings: state.settings }),
        }
    )
);

if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => worker?.terminate());
}

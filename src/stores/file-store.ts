import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import { FileNode, VimMode, FileInput, ProcessingResult, Settings, FileMetadata } from '@/lib/types';
import { toast } from 'sonner';

enableMapSet();

type FileWithPath = File & { webkitRelativePath: string };

// --- Worker Management ---

let worker: Worker | null = null;
const getWorker = (): Worker | null => {
    if (typeof window === 'undefined') return null;
    if (!worker) {
        worker = new Worker(new URL('../workers/file-processor.worker.ts', import.meta.url));
    }
    return worker;
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

    processFiles: (files: File[]) => Promise<void>;
    processDroppedFiles: (files: File[]) => Promise<void>;
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
    openPreview: (path: string) => void;
    closePreview: () => void;
}

const defaultSettings: Settings = {
    hideEmptyFolders: true,
    showTokenCount: true,
    maxFileSize: 2 * 1024 * 1024,
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

                const fileMap = new Map(pendingFiles.map((f) => [f.webkitRelativePath, f]));
                const fileInputs: FileInput[] = [];
                const rootFileContents = new Map<string, string>();

                const readPromises = pathsToRead.map(async (path) => {
                    const file = fileMap.get(path);
                    if (file) {
                        try {
                            const content = await file.text();
                            if (!content.includes('\uFFFD')) {
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
                pendingFiles = null;

                getWorker()?.postMessage({
                    type: 'process-files',
                    payload: { files: fileInputs, settings: get().settings }
                });
            };

            const workerInstance = getWorker();
            if (workerInstance) {
                workerInstance.onmessage = (event: MessageEvent) => {
                    const { type, payload } = event.data;

                    switch (type) {
                        case 'filter-complete': {
                            if (payload && Array.isArray(payload.paths) && payload.paths.length > 0) {
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
                            // If a toastId was provided, update the same toast
                            const toastId = event.data.toastId || undefined;
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

            return {
                fileTree: [], fileMap: new Map(), rootFiles: new Map(),
                isLoading: false, statusMessage: 'Ready. Drop a folder to get started.',
                settings: defaultSettings, currentFolderPath: null, navigationStack: [],
                vimMode: 'normal', selectedPaths: new Set(), cursorPath: null, visualAnchorPath: null,
                previewedFilePath: null,

                processFiles: async (files: File[]) => {
                    if (!files || files.length === 0) return;

                    set({ isLoading: true, statusMessage: 'Analyzing project structure...', fileTree: [], fileMap: new Map() });

                    const filesWithPath = files as FileWithPath[];
                    const firstPath = filesWithPath[0]?.webkitRelativePath;

                    if (!firstPath) {
                        toast.error("Could not process files.", { description: "The dropped items don't appear to be a folder." });
                        set({ isLoading: false, statusMessage: 'Error: Not a valid folder.' });
                        return;
                    }

                    pendingFiles = filesWithPath;

                    const gitignoreFile = filesWithPath.find((f) => f.webkitRelativePath.endsWith('.gitignore'));
                    const gitignoreContent = gitignoreFile ? await gitignoreFile.text() : '';
                    const rootPrefix = firstPath.substring(0, firstPath.indexOf('/') + 1);

                    const metadata: FileMetadata[] = filesWithPath.map((f) => ({ path: f.webkitRelativePath, size: f.size }));

                    getWorker()?.postMessage({
                        type: 'filter-files',
                        payload: { metadata, gitignoreContent, rootPrefix, settings: get().settings }
                    });
                },

                processDroppedFiles: async (files: File[]) => {
                    if (!files || files.length === 0) return;

                    set({ isLoading: true, statusMessage: 'Analyzing project structure...', fileTree: [], fileMap: new Map() });

                    // For dropped files, we use the 'path' property instead of 'webkitRelativePath'
                    const filesWithPath = files.map(file => {
                        const filePath = (file as File & { path?: string }).path;
                        if (!filePath) return null;

                        // Convert path to webkitRelativePath format (remove leading slash)
                        const normalizedPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;

                        // Add webkitRelativePath property to the original file object
                        Object.defineProperty(file, 'webkitRelativePath', {
                            value: normalizedPath,
                            writable: false,
                            enumerable: true,
                            configurable: false
                        });

                        return file as FileWithPath;
                    }).filter(Boolean) as FileWithPath[];

                    const firstPath = filesWithPath[0]?.webkitRelativePath;

                    if (!firstPath) {
                        toast.error("Could not process files.", { description: "The dropped items don't appear to be a folder." });
                        set({ isLoading: false, statusMessage: 'Error: Not a valid folder.' });
                        return;
                    }

                    pendingFiles = filesWithPath;

                    const gitignoreFile = filesWithPath.find((f) => f.webkitRelativePath.endsWith('.gitignore'));
                    const gitignoreContent = gitignoreFile ? await gitignoreFile.text() : '';
                    const rootPrefix = firstPath.substring(0, firstPath.indexOf('/') + 1);

                    const metadata: FileMetadata[] = filesWithPath.map((f) => ({ path: f.webkitRelativePath, size: f.size }));

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
                    getWorker()?.postMessage({
                        type: 'merge-files',
                        payload: { files: filesToMerge, options: { includePathHeaders: true }, toastId }
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
                        getWorker()?.postMessage({
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
    window.addEventListener('beforeunload', () => worker?.terminate());
}

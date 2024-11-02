import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { enableMapSet } from 'immer';
import { FileNode, VimMode, FileInput, ProcessingResult } from '@/lib/types';
import { toast } from 'sonner';

// Enable Map and Set support in Immer
enableMapSet();

// Enhanced gitignore matcher with performance optimizations
const createGitignoreMatcher = (gitignoreContent: string) => {
    const patterns = new Set<string>();
    const regexPatterns: RegExp[] = [];

    gitignoreContent.split(/\r?\n/).forEach((line) => {
        const rule = line.trim();
        if (!rule || rule.startsWith('#')) return;

        // Handle simple directory ignores
        if (rule.endsWith('/')) {
            patterns.add(rule.replace(/\/+$/, ''));
        } else if (rule.includes('*') || rule.includes('?')) {
            // Convert glob patterns to regex (simplified)
            const regexPattern = rule
                .replace(/\./g, '\\.')
                .replace(/\*/g, '.*')
                .replace(/\?/g, '.');
            try {
                regexPatterns.push(new RegExp(`^${regexPattern}$`));
            } catch {
                // Ignore invalid patterns
            }
        } else {
            patterns.add(rule);
        }
    });

    // Always ignore common heavy directories
    patterns.add('node_modules');
    patterns.add('.git');
    patterns.add('target');
    patterns.add('dist');
    patterns.add('build');
    patterns.add('.next');
    patterns.add('.nuxt');
    patterns.add('coverage');

    return (relativePath: string): boolean => {
        const segments = relativePath.split('/');

        // Check if any segment matches a simple pattern
        for (const segment of segments) {
            if (patterns.has(segment)) return true;
        }

        // Check regex patterns
        for (const regex of regexPatterns) {
            if (regex.test(relativePath)) return true;
        }

        return false;
    };
};

// Utility functions for tree operations
const flattenFileTree = (nodes: FileNode[]): Map<string, FileNode> => {
    const map = new Map<string, FileNode>();

    const traverse = (node: FileNode) => {
        map.set(node.path, node);
        if (node.is_dir && node.children) {
            node.children.forEach(traverse);
        }
    };

    nodes.forEach(traverse);
    return map;
};

const createFileLookupMap = (files: File[]): Map<string, File> => {
    const map = new Map<string, File>();

    for (const file of files) {
        const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        map.set(path, file);
    }

    return map;
};

// Enhanced worker management with error recovery
class WorkerManager {
    private worker: Worker | null = null;
    private messageHandlers = new Map<string, (payload: unknown) => void>();
    private isInitialized = false;

    constructor() {
        this.initializeWorker();
    }

    private initializeWorker() {
        if (typeof window === 'undefined') return;

        try {
            this.worker = new Worker(
                new URL('../workers/simple-worker.ts', import.meta.url)
            );

            this.worker.onmessage = (event: MessageEvent) => {
                try {
                    const { type, payload } = event.data;
                    const handler = this.messageHandlers.get(type);

                    if (handler) {
                        handler(payload);
                    } else {
                        console.warn(`Unhandled worker message type: ${type}`);
                    }
                } catch (error) {
                    console.error('Error handling worker message:', error);
                    toast.error('Error processing worker response');
                }
            };

            this.worker.onerror = (error) => {
                console.error('Worker error:', error);
                toast.error('Worker error occurred', {
                    description: 'File processing may be degraded'
                });
                this.reinitializeWorker();
            };

            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize worker:', error);
            toast.error('Failed to initialize file processor');
        }
    }

    private reinitializeWorker() {
        this.cleanup();
        setTimeout(() => this.initializeWorker(), 1000);
    }

    postMessage(type: string, payload: unknown) {
        if (!this.worker || !this.isInitialized) {
            console.error('Worker not available');
            toast.error('File processor not available');
            return;
        }

        try {
            this.worker.postMessage({ type, payload, requestId: `${Date.now()}-${Math.random()}` });
        } catch (error) {
            console.error('Failed to post message to worker:', error);
            toast.error('Failed to communicate with file processor');
        }
    }

    onMessage(type: string, handler: (payload: unknown) => void) {
        this.messageHandlers.set(type, handler);
    }

    cleanup() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.messageHandlers.clear();
        this.isInitialized = false;
    }
}

// Global worker instance
let workerManager: WorkerManager | null = null;

// Settings interface with validation
interface Settings {
    textOnly: boolean;
    hideEmptyFolders: boolean;
    showTokenCount: boolean;
    maxFileSize: number;
    autoSave: boolean;
}

interface ProcessingStats {
    totalFiles: number;
    totalTokens: number;
    totalSize: number;
    processingTime: number;
    lastProcessed: Date;
}

// Main store interface with enhanced typing
interface FileState {
    // Core data
    fileTree: FileNode[];
    fileMap: Map<string, FileNode>;
    rootFiles: FileInput[];

    // Processing state
    isLoading: boolean;
    processingStats: ProcessingStats | null;
    _fileLookupMap: Map<string, File> | null;

    // Navigation state
    currentFolderPath: string | null;
    navigationStack: (string | null)[];

    // Vim state
    vimMode: VimMode;
    selectedPaths: Set<string>;
    cursorPath: string | null;
    visualAnchorPath: string | null;

    // UI state
    statusMessage: string;
    settings: Settings;

    // Actions
    processFiles: (files: File[]) => Promise<void>;
    reprocessFiles: () => Promise<void>;
    setSettings: (newSettings: Partial<Settings>) => void;
    clearAll: () => void;

    // Navigation actions
    navigateInto: (path: string) => void;
    navigateBack: () => void;
    navigateToRoot: () => void;

    // Selection actions
    setCursor: (path: string | null) => void;
    toggleSelection: (path: string) => void;
    setSelection: (paths: Set<string>) => void;
    clearSelection: () => void;
    selectAll: () => void;

    // Vim actions
    setVimMode: (mode: VimMode) => void;
    setVisualAnchor: (path: string | null) => void;

    // File actions
    yankToClipboard: (pathsToYank?: Set<string>) => Promise<void>;
    deleteSelected: (pathsToDelete?: Set<string>) => void;

    // Utility actions
    getFileContent: (path: string) => string | null;
    getNodeAtPath: (path: string) => FileNode | undefined;
    exportToJSON: () => string;
    importFromJSON: (json: string) => boolean;
}

// Default settings with validation
const defaultSettings: Settings = {
    textOnly: true,
    hideEmptyFolders: true,
    showTokenCount: true,
    maxFileSize: 2 * 1024 * 1024, // 2MB
    autoSave: true,
};

const validateSettings = (settings: Partial<Settings>): Settings => {
    return {
        textOnly: settings.textOnly ?? defaultSettings.textOnly,
        hideEmptyFolders: settings.hideEmptyFolders ?? defaultSettings.hideEmptyFolders,
        showTokenCount: settings.showTokenCount ?? defaultSettings.showTokenCount,
        maxFileSize: Math.max(1024, Math.min(10 * 1024 * 1024, settings.maxFileSize ?? defaultSettings.maxFileSize)),
        autoSave: settings.autoSave ?? defaultSettings.autoSave,
    };
};

export const useFileStore = create<FileState>()(
    subscribeWithSelector(
        persist(
            immer((set, get) => {
                // Initialize worker manager
                if (typeof window !== 'undefined' && !workerManager) {
                    workerManager = new WorkerManager();

                    // Set up message handlers
                    workerManager.onMessage('filter-complete', async (payload: unknown) => {
                        const { _fileLookupMap } = get();

                        if (!_fileLookupMap) {
                            set((state) => {
                                state.isLoading = false;
                                state.statusMessage = 'Error: File lookup failed';
                            });
                            return;
                        }

                        // Handle both array and object responses from worker
                        let keptPaths: string[] = [];
                        if (Array.isArray(payload)) {
                            keptPaths = payload;
                        } else if (payload && typeof payload === 'object' && payload !== null && Array.isArray((payload as Record<string, unknown>).paths)) {
                            keptPaths = (payload as Record<string, unknown>).paths as string[];
                        } else if (payload && typeof payload === 'object' && payload !== null) {
                            // Fallback for other object structures
                            keptPaths = Object.values(payload as Record<string, unknown>).filter((item): item is string => typeof item === 'string');
                        }

                        console.log('Received keptPaths from worker:', keptPaths);

                        if (!Array.isArray(keptPaths) || keptPaths.length === 0) {
                            console.error('Invalid keptPaths received:', payload);
                            set((state) => {
                                state.isLoading = false;
                                state.statusMessage = 'No relevant files found. Check .gitignore or folder contents.';
                            });
                            toast.error('No relevant files found', {
                                description: 'All files were excluded by filters.'
                            });
                            return;
                        }

                        set((state) => {
                            state.statusMessage = `Reading ${keptPaths.length} files...`;
                        });

                        toast.info(`Reading ${keptPaths.length} files...`);

                        const filesToRead: File[] = keptPaths
                            .map(path => _fileLookupMap.get(path))
                            .filter((file): file is File => file !== undefined);

                        if (filesToRead.length === 0) {
                            console.error('No files found in lookup map for paths:', keptPaths);
                            set((state) => {
                                state.isLoading = false;
                                state.statusMessage = 'Error: Files not found in lookup map';
                            });
                            toast.error('Failed to locate files');
                            return;
                        }

                        set((state) => {
                            state._fileLookupMap = null;
                        });

                        try {
                            console.log('Reading files:', filesToRead.length);

                            if (!Array.isArray(filesToRead)) {
                                throw new Error('filesToRead is not an array');
                            }

                            const filePromises = filesToRead.map(file =>
                                new Promise<FileInput | null>((resolve) => {
                                    if (!file || typeof file.name !== 'string') {
                                        console.error('Invalid file object:', file);
                                        resolve(null);
                                        return;
                                    }

                                    const reader = new FileReader();
                                    reader.onload = () => resolve({
                                        path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
                                        content: reader.result as string
                                    });
                                    reader.onerror = () => {
                                        console.error(`Failed to read file: ${file.name}`);
                                        resolve(null);
                                    };
                                    reader.readAsText(file);
                                })
                            );

                            const fileInputs = (await Promise.all(filePromises))
                                .filter((file): file is FileInput => file !== null);

                            if (fileInputs.length === 0) {
                                throw new Error('No files could be read');
                            }

                            console.log('Successfully read files:', fileInputs.length);

                            set((state) => {
                                state.rootFiles = fileInputs;
                                state.statusMessage = 'Building file tree...';
                            });

                            workerManager?.postMessage('process-files', {
                                files: fileInputs,
                                settings: get().settings
                            });
                        } catch (error) {
                            console.error('Error reading files:', error);
                            set((state) => {
                                state.isLoading = false;
                                state.statusMessage = 'Error reading files';
                            });
                            toast.error('Failed to read files');
                        }
                    });

                    workerManager.onMessage('processing-complete', (payload: unknown) => {
                        const result = payload as ProcessingResult;
                        const fileMap = flattenFileTree(result.file_tree);
                        const { settings, currentFolderPath, cursorPath } = get();

                        const stats: ProcessingStats = {
                            totalFiles: result.total_files,
                            totalTokens: result.total_tokens,
                            totalSize: result.total_size ?? 0,
                            processingTime: result.processing_time_ms ?? 0,
                            lastProcessed: new Date(),
                        };

                        const tokenPart = settings.showTokenCount
                            ? ` (${result.total_tokens.toLocaleString()} tokens)`
                            : '';

                        // Determine if we should preserve navigation state or reset
                        const shouldPreserveNavigation = currentFolderPath !== null;

                        // If preserving navigation, validate that the current folder still exists
                        const folderStillExists = shouldPreserveNavigation && fileMap.has(currentFolderPath!);

                        // Validate cursor path still exists in the current view
                        let validatedCursorPath = cursorPath;
                        if (shouldPreserveNavigation && folderStillExists) {
                            const currentFolder = fileMap.get(currentFolderPath!);
                            const currentView = currentFolder?.children || [];
                            const cursorExists = cursorPath && (
                                cursorPath === '..' ||
                                currentView.some(item => item.path === cursorPath)
                            );

                            if (!cursorExists) {
                                // Set cursor to first item in current view or '..' if in subfolder
                                validatedCursorPath = currentView.length > 0 ? currentView[0].path : '..';
                            }
                        } else if (!shouldPreserveNavigation) {
                            // Reset to root - set cursor to first item if available
                            validatedCursorPath = result.file_tree[0]?.path || null;
                        }

                        set((state) => {
                            state.fileTree = result.file_tree;
                            state.fileMap = fileMap;
                            state.isLoading = false;
                            state.processingStats = stats;
                            state.statusMessage = `Processed ${result.total_files} files${tokenPart}`;

                            // Preserve or reset navigation state based on context
                            if (shouldPreserveNavigation && folderStillExists) {
                                // Keep current navigation state
                                state.cursorPath = validatedCursorPath;
                            } else {
                                // Reset navigation state
                                state.currentFolderPath = null;
                                state.navigationStack = [];
                                state.cursorPath = validatedCursorPath;
                            }
                        });

                        toast.success('Files processed successfully!', {
                            description: `${result.total_files} files processed in ${result.processing_time_ms ?? 0}ms`
                        });
                    });

                    workerManager.onMessage('processing-error', (payload: unknown) => {
                        const error = payload as string;
                        set((state) => {
                            state.isLoading = false;
                            state.statusMessage = `Error: ${error}`;
                        });
                        toast.error('File processing failed', { description: error });
                    });

                    workerManager.onMessage('markdown-result', async (payload: unknown) => {
                        const markdown = payload as string;
                        try {
                            await navigator.clipboard.writeText(markdown);
                            set((state) => {
                                state.statusMessage = 'Copied to clipboard!';
                            });
                            toast.success('Copied to clipboard!');
                        } catch (error) {
                            console.error('Failed to copy to clipboard:', error);
                            toast.error('Failed to copy to clipboard');
                        }
                    });
                }

                return {
                    // Initial state
                    fileTree: [],
                    fileMap: new Map(),
                    rootFiles: [],
                    isLoading: false,
                    processingStats: null,
                    _fileLookupMap: null,

                    currentFolderPath: null,
                    navigationStack: [],

                    vimMode: 'normal',
                    selectedPaths: new Set(),
                    cursorPath: null,
                    visualAnchorPath: null,

                    statusMessage: 'Ready. Drag and drop files or folders.',
                    settings: defaultSettings,

                    // File processing
                    processFiles: async (files: File[]) => {
                        if (files.length === 0) return;

                        set((state) => {
                            state.isLoading = true;
                            state.statusMessage = 'Building file index...';
                            state.fileTree = [];
                            state.fileMap = new Map();
                            state.selectedPaths = new Set();
                            state.currentFolderPath = null;
                            state.navigationStack = [];
                            state.cursorPath = null;
                        });

                        try {
                            const firstPath = (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath || files[0].name;
                            const slashIndex = firstPath.indexOf('/');
                            const rootPrefix = slashIndex > -1 ? firstPath.substring(0, slashIndex + 1) : '';

                            // Find and read .gitignore
                            let gitignoreContent = '';
                            const gitignoreFile = files.find(f => {
                                const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
                                return rel === `${rootPrefix}.gitignore` || rel === '.gitignore';
                            });

                            if (gitignoreFile) {
                                gitignoreContent = await gitignoreFile.text();
                            }

                            // Pre-filter with lightweight directory matching
                            const shouldIgnore = createGitignoreMatcher(gitignoreContent);
                            const preFilteredFiles: File[] = [];
                            const metadata: { path: string; size: number }[] = [];

                            for (const file of files) {
                                const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
                                const relative = rootPrefix && path.startsWith(rootPrefix)
                                    ? path.slice(rootPrefix.length)
                                    : path;

                                if (shouldIgnore(relative)) continue;

                                preFilteredFiles.push(file);
                                metadata.push({ path, size: file.size });
                            }

                            toast.info(`Indexing ${preFilteredFiles.length} files (after .gitignore)...`);

                            const fileLookupMap = createFileLookupMap(preFilteredFiles);

                            set((state) => {
                                state._fileLookupMap = fileLookupMap;
                                state.statusMessage = 'Filtering files...';
                            });

                            workerManager?.postMessage('filter-files', {
                                metadata,
                                gitignoreContent,
                                rootPrefix,
                                settings: get().settings
                            });
                        } catch (error) {
                            console.error('Error processing files:', error);
                            set((state) => {
                                state.isLoading = false;
                                state.statusMessage = 'Error processing files';
                            });
                            toast.error('Failed to process files');
                        }
                    },

                    reprocessFiles: async () => {
                        const { rootFiles, settings } = get();
                        if (rootFiles.length === 0) {
                            toast.warning('No files to reprocess');
                            return;
                        }

                        set((state) => {
                            state.isLoading = true;
                            state.statusMessage = 'Re-processing files...';
                        });

                        workerManager?.postMessage('process-files', { files: rootFiles, settings });
                    },

                    setSettings: (newSettings) => {
                        set((state) => {
                            state.settings = validateSettings({ ...state.settings, ...newSettings });
                        });

                        if (get().rootFiles.length > 0) {
                            get().reprocessFiles();
                        }
                    },

                    clearAll: () => {
                        set((state) => {
                            state.fileTree = [];
                            state.fileMap = new Map();
                            state.rootFiles = [];
                            state._fileLookupMap = null;
                            state.isLoading = false;
                            state.processingStats = null;
                            state.currentFolderPath = null;
                            state.navigationStack = [];
                            state.vimMode = 'normal';
                            state.selectedPaths = new Set();
                            state.cursorPath = null;
                            state.visualAnchorPath = null;
                            state.statusMessage = 'Cleared. Ready for new files.';
                        });
                        toast.info('All files cleared');
                    },

                    // Navigation
                    navigateInto: (path) => {
                        const { fileMap, currentFolderPath, navigationStack } = get();
                        const node = fileMap.get(path);

                        if (node?.is_dir) {
                            set((state) => {
                                state.navigationStack = [...navigationStack, currentFolderPath];
                                state.currentFolderPath = path;
                                state.cursorPath = '..';
                            });
                        }
                    },

                    navigateBack: () => {
                        const { navigationStack } = get();
                        if (navigationStack.length > 0) {
                            set((state) => {
                                const newStack = [...navigationStack];
                                const newPath = newStack.pop()!;
                                const previousPath = state.currentFolderPath;
                                state.navigationStack = newStack;
                                state.currentFolderPath = newPath;
                                state.cursorPath = previousPath;
                            });
                        }
                    },

                    navigateToRoot: () => {
                        set((state) => {
                            state.currentFolderPath = null;
                            state.navigationStack = [];
                            state.cursorPath = state.fileTree[0]?.path || null;
                        });
                    },

                    // Selection
                    setCursor: (path) => {
                        set((state) => {
                            state.cursorPath = path;
                        });
                    },

                    toggleSelection: (path) => {
                        set((state) => {
                            const newSelected = new Set(state.selectedPaths);
                            if (newSelected.has(path)) {
                                newSelected.delete(path);
                            } else {
                                newSelected.add(path);
                            }
                            state.selectedPaths = newSelected;
                        });
                    },

                    setSelection: (paths) => {
                        set((state) => {
                            state.selectedPaths = new Set(paths);
                        });
                    },

                    clearSelection: () => {
                        set((state) => {
                            state.selectedPaths = new Set();
                        });
                    },

                    selectAll: () => {
                        const { fileMap } = get();
                        const allPaths = new Set(Array.from(fileMap.keys()).filter(path => path !== '..'));

                        set((state) => {
                            state.selectedPaths = allPaths;
                        });
                    },

                    // Vim
                    setVimMode: (mode) => {
                        set((state) => {
                            state.vimMode = mode;
                            if (mode === 'normal') {
                                state.visualAnchorPath = null;
                            }
                        });
                    },

                    setVisualAnchor: (path) => {
                        set((state) => {
                            state.visualAnchorPath = path;
                        });
                    },

                    // File actions
                    yankToClipboard: async (pathsToYank) => {
                        const { selectedPaths, fileMap, rootFiles } = get();
                        const paths = pathsToYank || selectedPaths;

                        if (paths.size === 0) {
                            toast.warning('Nothing selected to copy');
                            return;
                        }

                        // Collect all files recursively
                        const selectedFilePaths = new Set<string>();

                        const collectFiles = (node: FileNode) => {
                            if (!node.is_dir) {
                                selectedFilePaths.add(node.path);
                            } else if (node.children) {
                                node.children.forEach(collectFiles);
                            }
                        };

                        paths.forEach((path) => {
                            if (path === '..') return;
                            const node = fileMap.get(path);
                            if (node) {
                                collectFiles(node);
                            }
                        });

                        const filesToMerge = rootFiles.filter(file => selectedFilePaths.has(file.path));

                        if (filesToMerge.length === 0) {
                            toast.warning('Selection contains no files to copy');
                            return;
                        }

                        toast.info(`Copying ${filesToMerge.length} files to clipboard...`);

                        // Inline markdown generation and copy
                        const markdown = filesToMerge.map(file => {
                            const ext = file.path.split('.').pop()?.toLowerCase() || '';
                            const language = ext;
                            return `\`\`\`${language}\n${file.content.trim()}\n\`\`\``;
                        }).join('\n\n');
                        try {
                            await navigator.clipboard.writeText(markdown);
                            set((state) => { state.statusMessage = 'Copied to clipboard!'; });
                            toast.success('Copied to clipboard!');
                        } catch (error) {
                            console.error('Failed to copy to clipboard:', error);
                            toast.error('Failed to copy to clipboard');
                        }
                    },

                    deleteSelected: (pathsToDelete) => {
                        const { selectedPaths, fileMap, rootFiles, settings, currentFolderPath, cursorPath } = get();
                        const paths = pathsToDelete || selectedPaths;

                        if (paths.size === 0) {
                            toast.warning('Nothing selected to delete');
                            return;
                        }

                        const filesToDelete = new Set<string>();

                        const collectFiles = (node: FileNode) => {
                            if (!node.is_dir) {
                                filesToDelete.add(node.path);
                            } else {
                                node.children?.forEach(collectFiles);
                            }
                        };

                        paths.forEach((path) => {
                            if (path === '..') return;
                            const node = fileMap.get(path);
                            if (node) {
                                collectFiles(node);
                            }
                        });

                        if (filesToDelete.size === 0) {
                            toast.warning('Selection contains no files to delete');
                            return;
                        }

                        const newRootFiles = rootFiles.filter(file => !filesToDelete.has(file.path));

                        // Get current view to determine next cursor position
                        const currentView: FileNode[] = currentFolderPath
                            ? fileMap.get(currentFolderPath)?.children || []
                            : get().fileTree;

                        // Find the next item to select after deletion
                        let nextCursorPath: string | null = null;
                        if (currentView.length > 0) {
                            // Find the current cursor index
                            const currentIndex = cursorPath ? currentView.findIndex(item => item.path === cursorPath) : -1;

                            // Filter out deleted items from current view
                            const remainingItems = currentView.filter(item => !paths.has(item.path));

                            if (remainingItems.length > 0) {
                                // Try to select the item at the same index, or the previous one if at the end
                                const targetIndex = Math.min(currentIndex, remainingItems.length - 1);
                                nextCursorPath = remainingItems[Math.max(0, targetIndex)]?.path || null;
                            }
                        }

                        set((state) => {
                            state.statusMessage = `Removed ${filesToDelete.size} items. Re-processing...`;
                            state.isLoading = true;
                            state.rootFiles = newRootFiles;
                            state.selectedPaths = new Set();
                            state.vimMode = 'normal';
                            state.visualAnchorPath = null;
                            // Preserve navigation state
                            // Don't reset currentFolderPath and navigationStack
                            // Set the next cursor position after deletion
                            state.cursorPath = nextCursorPath;
                        });

                        workerManager?.postMessage('process-files', { files: newRootFiles, settings });
                    },

                    // Utilities
                    getFileContent: (path) => {
                        const { rootFiles } = get();
                        const file = rootFiles.find(f => f.path === path);
                        return file?.content || null;
                    },

                    getNodeAtPath: (path) => {
                        const { fileMap } = get();
                        return fileMap.get(path);
                    },

                    exportToJSON: () => {
                        const { rootFiles, settings, processingStats } = get();
                        const exportData = {
                            files: rootFiles,
                            settings,
                            stats: processingStats,
                            exportedAt: new Date().toISOString(),
                            version: '2.0.0',
                        };
                        return JSON.stringify(exportData, null, 2);
                    },

                    importFromJSON: (json) => {
                        try {
                            const data = JSON.parse(json);

                            if (!data.files || !Array.isArray(data.files)) {
                                throw new Error('Invalid file data');
                            }

                            set((state) => {
                                state.rootFiles = data.files;
                                state.settings = validateSettings(data.settings || {});
                                state.processingStats = data.stats || null;
                            });

                            get().reprocessFiles();
                            toast.success('Files imported successfully');
                            return true;
                        } catch (error) {
                            console.error('Import failed:', error);
                            toast.error('Failed to import files');
                            return false;
                        }
                    },
                };
            }),
            {
                name: 'contexter-file-store',
                storage: createJSONStorage(() => localStorage),
                partialize: (state) => ({
                    settings: state.settings,
                }),
                version: 2,
                migrate: (persistedState: unknown, version: number) => {
                    const state = persistedState as Record<string, unknown>;
                    if (version < 2) {
                        // Migrate from v1 to v2
                        return {
                            settings: validateSettings((state?.settings as Partial<Settings>) || {}),
                        };
                    }
                    return persistedState;
                },
            }
        )
    )
);

// Cleanup function for worker
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        workerManager?.cleanup();
    });
}

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
// Lightweight .gitignore-style matcher for **directory** excludes (e.g. node_modules/).
// We intentionally keep the parsing extremely small to avoid big dependencies.
const buildDirIgnoreMatcher = (gitignore: string) => {
    const dirs = new Set<string>();
    gitignore.split(/\r?\n/).forEach((line) => {
        const rule = line.trim();
        if (!rule || rule.startsWith('#')) return;
        // Only support simple directory ignores like "node_modules/" or "dist/"
        if (rule.endsWith('/')) {
            dirs.add(rule.replace(/\/+$/, ''));
        } else {
            dirs.add(rule);
        }
    });
    // Always ignore these heavy folders as safety net.
    dirs.add('node_modules');
    dirs.add('.git');
    return (relativePath: string) => {
        // fast check: does any dir segment match an ignored dir?
        return relativePath.split('/').some((seg) => dirs.has(seg));
    };
};
import { FileNode, VimMode, FileInput, ProcessingResult } from '@/lib/types';
import { toast } from 'sonner';

let worker: Worker | undefined;
if (typeof window !== 'undefined') {
    worker = new Worker(new URL('../workers/file-processor.worker.ts', import.meta.url));
}

const flattenTree = (nodes: FileNode[]): Map<string, FileNode> => {
    const map = new Map<string, FileNode>();
    const traverse = (node: FileNode) => {
        map.set(node.path, node);
        if (node.is_dir) node.children?.forEach(traverse);
    };
    nodes.forEach(traverse);
    return map;
};

interface Settings { textOnly: boolean; hideEmptyFolders: boolean; showTokenCount: boolean; }
interface FileState {
    fileTree: FileNode[]; fileMap: Map<string, FileNode>; rootFiles: FileInput[];
    isLoading: boolean; _fileLookupMap: Map<string, File> | null;
    currentFolderPath: string | null; navStack: (string | null)[];
    vimMode: VimMode; selectedPaths: Set<string>; cursorPath: string | null; visualAnchorPath: string | null;
    statusMessage: string; settings: Settings;
    processFiles: (files: File[]) => void;
    setSettings: (newSettings: Partial<Settings>) => void;
    clearAll: () => void;
    navigateInto: (path: string) => void; navigateBack: () => void;
    setCursor: (path: string | null) => void; toggleSelection: (path: string) => void;
    setSelection: (paths: Set<string>) => void; selectAllBelow: () => void;
    setVimMode: (mode: VimMode) => void; setVisualAnchor: (path: string | null) => void;
    yankToClipboard: () => void; deleteSelected: () => void;
}

export const useFileStore = create<FileState>()(
    persist(
        (set, get) => {
            const handleWorkerMessage = async (event: MessageEvent) => {
                const { type, payload } = event.data;

                if (type === 'filter-complete') {
                    const keptPaths = payload as string[];
                    const { _fileLookupMap } = get();

                    if (!_fileLookupMap) return;
                    if (keptPaths.length === 0) {
                        set({ isLoading: false, statusMessage: 'No relevant files found. Check .gitignore or folder contents.' });
                        toast.error('No relevant files found', { description: 'All files seem to be excluded by .gitignore or filters.' });
                        return;
                    }

                    set({ statusMessage: `Reading ${keptPaths.length} files...` });
                    toast.info(`Reading ${keptPaths.length} files...`);

                    const filesToRead: File[] = [];
                    for (const path of keptPaths) {
                        const file = _fileLookupMap.get(path);
                        if (file) filesToRead.push(file);
                    }
                    set({ _fileLookupMap: null });

                    const filePromises = filesToRead.map((file) => new Promise<FileInput | null>((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve({ path: (file as any).webkitRelativePath || file.name, content: reader.result as string });
                        reader.onerror = () => resolve(null);
                        reader.readAsText(file);
                    }));

                    const fileInputs = (await Promise.all(filePromises)).filter(Boolean) as FileInput[];
                    set({ rootFiles: fileInputs, statusMessage: 'Building file tree with WASM...' });
                    worker?.postMessage({
                        type: 'process-files',
                        payload: { files: fileInputs, settings: get().settings },
                    });

                } else if (type === 'processing-complete') {
                    const result = payload as ProcessingResult;
                    const fileMap = flattenTree(result.file_tree);
                    const { settings } = get();
                    const tokenPart = settings.showTokenCount ? ` (${result.total_tokens.toLocaleString()} tokens)` : '';
                    set({
                        fileTree: result.file_tree, fileMap, isLoading: false,
                        statusMessage: `Processed ${result.total_files} files${tokenPart}.`,
                        cursorPath: result.file_tree[0]?.path || null, navStack: [], currentFolderPath: null,
                    });
                    toast.success('Files processed successfully!');
                } else if (type === 'processing-error') {
                    set({ isLoading: false, statusMessage: `Error: ${payload}` });
                    toast.error('File processing failed.', { description: payload });
                } else if (type === 'markdown-result') {
                    navigator.clipboard.writeText(payload).then(() => {
                        set({ statusMessage: 'Copied to clipboard!' });
                        toast.success('Copied to clipboard!');
                    });
                }
            };

            if (worker) worker.onmessage = handleWorkerMessage;

            return {
                fileTree: [], fileMap: new Map(), rootFiles: [], _fileLookupMap: null, isLoading: false,
                currentFolderPath: null, navStack: [], vimMode: 'normal', selectedPaths: new Set(),
                cursorPath: null, visualAnchorPath: null, statusMessage: 'Ready. Drag and drop files or a folder.',
                settings: { textOnly: true, hideEmptyFolders: true, showTokenCount: true },

                processFiles: async (files: File[]) => {
                    if (files.length === 0) return;

                    set({
                        isLoading: true,
                        statusMessage: 'Building file index...',
                        fileTree: [],
                        fileMap: new Map(),
                        selectedPaths: new Set(),
                        currentFolderPath: null,
                        navStack: [],
                        cursorPath: null,
                    });

                    // 1️⃣ Establish rootPrefix based on the first dropped entry
                    const firstPath = (files[0] as any).webkitRelativePath || files[0].name;
                    const slashIndex = firstPath.indexOf('/');
                    const rootPrefix = slashIndex > -1 ? firstPath.substring(0, slashIndex + 1) : '';

                    // 2️⃣ Load .gitignore (if present in the root) so we can filter early
                    let gitignoreContent = '';
                    let gitignoreFile: File | undefined;
                    for (const f of files) {
                        const rel = (f as any).webkitRelativePath || f.name;
                        if (rel === `${rootPrefix}.gitignore`) {
                            gitignoreFile = f;
                            break;
                        }
                    }
                    if (gitignoreFile) gitignoreContent = await gitignoreFile.text();

                    // 3️⃣ Build a fast directory-ignore matcher from .gitignore
                    const shouldIgnore = buildDirIgnoreMatcher(gitignoreContent);

                    // 4️⃣ Pre-filter the incoming file list before any heavy work
                    const preFilteredFiles: File[] = [];
                    const metadata: { path: string; size: number }[] = [];
                    for (const file of files) {
                        const path = (file as any).webkitRelativePath || file.name;
                        const relative = rootPrefix && path.startsWith(rootPrefix) ? path.slice(rootPrefix.length) : path;
                        if (shouldIgnore(relative)) continue; // Skip ignored entries early ⏩

                        preFilteredFiles.push(file);
                        metadata.push({ path, size: file.size });
                    }

                    toast.info(`Indexing ${preFilteredFiles.length} files (after .gitignore)…`);

                    // 5️⃣ Store a lookup map ONLY for the pre-filtered set
                    const fileLookupMap = new Map<string, File>();
                    for (const file of preFilteredFiles) {
                        fileLookupMap.set((file as any).webkitRelativePath || file.name, file);
                    }
                    set({ _fileLookupMap: fileLookupMap });

                    // 6️⃣ Delegate the fine-grained filtering (size, textOnly, etc.) to the WASM worker
                    set({ statusMessage: 'Filtering files with WASM…' });
                    worker?.postMessage({
                        type: 'filter-files',
                        payload: { metadata, gitignoreContent, rootPrefix, settings: get().settings },
                    });
                },

                setSettings: (newSettings) => {
                    const currentSettings = get().settings;
                    const updatedSettings = { ...currentSettings, ...newSettings };
                    set({ settings: updatedSettings });
                    if (get().rootFiles.length > 0) {
                        toast.info('Re-processing files with new settings...');
                        set({ isLoading: true, statusMessage: 'Re-processing files...' });
                        worker?.postMessage({
                            type: 'process-files',
                            payload: { files: get().rootFiles, settings: updatedSettings },
                        });
                    }
                },

                clearAll: () => set({
                    fileTree: [], fileMap: new Map(), rootFiles: [], _fileLookupMap: null,
                    isLoading: false, currentFolderPath: null, navStack: [], vimMode: 'normal',
                    selectedPaths: new Set(), cursorPath: null, visualAnchorPath: null,
                    statusMessage: 'Cleared. Ready for new files.',
                }),

                navigateInto: (path) => {
                    const { fileMap, currentFolderPath, navStack } = get();
                    const node = fileMap.get(path);
                    if (node?.is_dir) set({
                        navStack: [...navStack, currentFolderPath], currentFolderPath: path,
                        cursorPath: node.children[0]?.path || null,
                    });
                },

                navigateBack: () => {
                    const { navStack } = get();
                    if (navStack.length > 0) {
                        const newStack = [...navStack];
                        const newPath = newStack.pop()!;
                        const previousPath = get().currentFolderPath;
                        set({ navStack: newStack, currentFolderPath: newPath, cursorPath: previousPath });
                    }
                },

                setCursor: (path) => set({ cursorPath: path }),
                toggleSelection: (path) => set(state => {
                    const newSelected = new Set(state.selectedPaths);
                    if (newSelected.has(path)) newSelected.delete(path); else newSelected.add(path);
                    return { selectedPaths: newSelected };
                }),
                setSelection: (paths) => set({ selectedPaths: paths }),
                selectAllBelow: () => set(state => {
                    if (!state.cursorPath) return {};
                    const view = state.currentFolderPath ? state.fileMap.get(state.currentFolderPath)?.children || [] : state.fileTree;
                    const cursorIndex = view.findIndex((item) => item.path === state.cursorPath);
                    if (cursorIndex === -1) return {};
                    const newSelected = new Set(state.selectedPaths);
                    for (let i = cursorIndex; i < view.length; i++) newSelected.add(view[i].path);
                    return { selectedPaths: newSelected };
                }),
                setVimMode: (mode) => set(state => ({ vimMode: mode, visualAnchorPath: mode === 'normal' ? null : state.visualAnchorPath })),
                setVisualAnchor: (path) => set({ visualAnchorPath: path }),

                yankToClipboard: () => {
                    const { selectedPaths, fileMap, rootFiles } = get();
                    if (selectedPaths.size === 0) { toast.warning('Nothing selected to copy.'); return; }
                    const selectedFilePaths = new Set<string>();
                    const collectFiles = (node: FileNode) => {
                        if (!node.is_dir) selectedFilePaths.add(node.path); else node.children?.forEach(collectFiles);
                    };
                    selectedPaths.forEach((path) => { if (fileMap.has(path)) collectFiles(fileMap.get(path)!); });
                    const filesToMerge = rootFiles.filter((file) => selectedFilePaths.has(file.path));
                    if (filesToMerge.length === 0) { toast.warning('Selection contains no files to copy.'); return; }
                    toast.info(`Copying ${filesToMerge.length} files to clipboard...`);
                    worker?.postMessage({ type: 'merge-files', payload: filesToMerge });
                },

                deleteSelected: () => {
                    const { selectedPaths, rootFiles } = get();
                    if (selectedPaths.size === 0) { toast.warning('Nothing selected to delete.'); return; }
                    const newRootFiles = rootFiles.filter((file) => !selectedPaths.has(file.path));
                    set({
                        statusMessage: `Removed ${selectedPaths.size} items. Re-processing...`,
                        isLoading: true, rootFiles: newRootFiles, selectedPaths: new Set(),
                    });
                    worker?.postMessage({
                        type: 'process-files',
                        payload: { files: newRootFiles, settings: get().settings },
                    });
                },
            };
        },
        {
            name: 'contexter-settings',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ settings: state.settings }),
        }
    )
);

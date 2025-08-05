import { useEffect, useCallback, useRef } from 'react';
import { useFileStore } from '@/stores/file-store';
import { FileNode } from '@/lib/types';
import { toast } from 'sonner';

/**
 * Implements keyboard navigation for the file tree, supporting both VIM and Standard modes.
 */
export const useKeybindings = () => {
    const storeRef = useRef(useFileStore.getState());
    useEffect(() => useFileStore.subscribe(state => (storeRef.current = state)), []);

    const getCurrentView = useCallback((): FileNode[] => {
        const { currentFolderPath, fileMap, fileTree } = storeRef.current;
        const items = currentFolderPath ? fileMap.get(currentFolderPath)?.children ?? [] : fileTree;
        if (currentFolderPath) {
            return [{ name: '..', path: '..', is_dir: true, children: [] }, ...items];
        }
        return items;
    }, []);

    const updateVisualSelection = useCallback((newCursorPath: string, view: FileNode[]) => {
        const { visualAnchorPath, setSelection } = storeRef.current;
        if (!visualAnchorPath) return;

        const anchorIndex = view.findIndex(item => item.path === visualAnchorPath);
        const cursorIndex = view.findIndex(item => item.path === newCursorPath);
        if (anchorIndex === -1 || cursorIndex === -1) return;

        const start = Math.min(anchorIndex, cursorIndex);
        const end = Math.max(anchorIndex, cursorIndex);

        const newSelection = new Set<string>();
        for (let i = start; i <= end; i++) {
            if (view[i]?.path !== '..') {
                newSelection.add(view[i].path);
            }
        }
        setSelection(newSelection);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
                return;
            }

            const store = storeRef.current;
            const view = getCurrentView();

            // --- Global Handlers (Preview Modal) ---
            if (store.previewedFilePath) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    store.closePreview();
                } else if (e.key === 'y' && store.settings.keybindingMode === 'vim') {
                    e.preventDefault();
                    const content = store.rootFiles.get(store.previewedFilePath);
                    if (content) {
                        navigator.clipboard.writeText(content)
                            .then(() => toast.success("File content copied to clipboard!"))
                            .catch(() => toast.error("Failed to copy content."));
                    }
                }
                return;
            }

            if (view.length === 0) return;

            // --- Mode-Specific Handlers ---
            if (store.settings.keybindingMode === 'vim') {
                handleVimKeys(e, view);
            } else {
                handleStandardKeys(e, view);
            }
        };

        const handleStandardKeys = (e: KeyboardEvent, view: FileNode[]) => {
            const store = storeRef.current;

            const ctrlOrMeta = e.metaKey || e.ctrlKey;
            const key = e.key;

            // Determine if we will handle this key to prevent default browser behavior
            const isHandledKey =
                // Navigation and action keys
                /^(ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Enter|Escape| |Delete|Home|End)$/i.test(key) ||
                // Ctrl/Meta combos we support
                (ctrlOrMeta && /^(a|c|A|C|Enter|Delete)$/i.test(key));

            if (!isHandledKey) return;

            // Prevent default only for keys we explicitly handle; allow Ctrl+C to work reliably by handling it here.
            e.preventDefault();

            const moveAndSelect = (delta: number) => {
                const currentIndex = store.cursorPath ? view.findIndex(item => item.path === store.cursorPath) : -1;
                const baseIndex = currentIndex === -1 ? 0 : currentIndex;
                const newIndex = Math.max(0, Math.min(view.length - 1, baseIndex + delta));
                const newCursorPath = view[newIndex]?.path;

                if (!newCursorPath || newCursorPath === store.cursorPath) return;

                if (e.shiftKey) {
                    if (!store.visualAnchorPath) store.setVisualAnchor(store.cursorPath);
                    store.setCursor(newCursorPath);
                    updateVisualSelection(newCursorPath, view);
                } else {
                    store.setVisualAnchor(null);
                    store.setCursor(newCursorPath);
                    store.setSelection(new Set());
                }
            };

            const goToIndex = (index: number) => {
                const newIndex = Math.max(0, Math.min(view.length - 1, index));
                const newCursorPath = view[newIndex]?.path;
                if (!newCursorPath) return;

                if (e.shiftKey) {
                    if (!store.visualAnchorPath) store.setVisualAnchor(store.cursorPath);
                    store.setCursor(newCursorPath);
                    updateVisualSelection(newCursorPath, view);
                } else {
                    store.setVisualAnchor(null);
                    store.setCursor(newCursorPath);
                    store.setSelection(new Set());
                }
            };

            const handleEnterOrArrowRight = () => {
                if (!store.cursorPath) return;
                if (store.cursorPath === '..') {
                    store.navigateBack();
                    return;
                }
                const node = store.fileMap.get(store.cursorPath);
                if (!node) return;
                if (node.is_dir) {
                    store.navigateInto(store.cursorPath);
                } else {
                    store.openPreview(store.cursorPath);
                }
            };

            const handleDelete = () => {
                if (store.selectedPaths.size === 0 && store.cursorPath && store.cursorPath !== '..') {
                    store.deleteSelected(new Set([store.cursorPath]));
                } else {
                    store.deleteSelected();
                }
            };

            // Handle Ctrl/Meta combos first
            if (ctrlOrMeta) {
                switch (key.toLowerCase()) {
                    case 'a': {
                        const allPaths = new Set(view.map(item => item.path).filter(p => p !== '..'));
                        store.setSelection(allPaths);
                        return;
                    }
                    case 'c': {
                        // If there's an active preview, prefer native copying of selection; otherwise, yank selected/files.
                        if (store.previewedFilePath) {
                            // Let browser handle copy for text selection inside preview; do not override.
                            return;
                        }
                        // If nothing is selected, yank current item if valid; else yank selection set.
                        if (store.selectedPaths.size === 0 && store.cursorPath && store.cursorPath !== '..') {
                            store.yankToClipboard(new Set([store.cursorPath]));
                        } else {
                            store.yankToClipboard();
                        }
                        return;
                    }
                    case 'enter':
                        if (store.cursorPath) {
                            const node = store.fileMap.get(store.cursorPath);
                            if (node && !node.is_dir) store.openPreview(store.cursorPath);
                        }
                        return;
                    case 'delete':
                        handleDelete();
                        return;
                }
            }

            // Non-modifier keys
            switch (key) {
                case 'ArrowDown': return moveAndSelect(1);
                case 'ArrowUp': return moveAndSelect(-1);
                case 'ArrowLeft': return store.navigateBack();
                case 'ArrowRight':
                case 'Enter': return handleEnterOrArrowRight();
                case 'Home': return goToIndex(0);
                case 'End': return goToIndex(view.length - 1);
                case ' ': {
                    if (store.cursorPath && store.cursorPath !== '..') store.toggleSelection(store.cursorPath);
                    return;
                }
                case 'Escape': {
                    store.setSelection(new Set());
                    store.setVisualAnchor(null);
                    return;
                }
                case 'Delete': {
                    handleDelete();
                    return;
                }
            }
        };

        const handleVimKeys = (e: KeyboardEvent, view: FileNode[]) => {
            const store = storeRef.current;
            // Include all handled keys explicitly; ensure 'd' is captured
            const isHandledKey = /^(j|k|h|l|G|g|v|V|y|d|C|o| |Enter|Escape|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/.test(e.key);
            if (isHandledKey) e.preventDefault();
            else return;

            const moveCursor = (delta: number) => {
                const currentIndex = store.cursorPath ? view.findIndex(item => item.path === store.cursorPath) : -1;
                const newIndex = Math.max(0, Math.min(view.length - 1, (currentIndex === -1 ? 0 : currentIndex) + delta));
                const newCursorPath = view[newIndex]?.path;

                if (newCursorPath && newCursorPath !== store.cursorPath) {
                    store.setCursor(newCursorPath);
                    if (store.vimMode === 'visual') updateVisualSelection(newCursorPath, view);
                }
            };

            const goTo = (position: 'first' | 'last') => {
                const newCursorPath = (position === 'first' ? view[0] : view[view.length - 1])?.path;
                if (newCursorPath) {
                    store.setCursor(newCursorPath);
                    if (store.vimMode === 'visual') updateVisualSelection(newCursorPath, view);
                }
            };

            const exitVisualMode = () => store.setVimMode('normal');

            const yank = () => {
                if (store.selectedPaths.size > 0) store.yankToClipboard();
                else if (store.cursorPath && store.cursorPath !== '..') store.yankToClipboard(new Set([store.cursorPath]));
                exitVisualMode();
            };

            const del = () => {
                if (store.selectedPaths.size > 0) store.deleteSelected();
                else if (store.cursorPath && store.cursorPath !== '..') store.deleteSelected(new Set([store.cursorPath]));
                exitVisualMode();
            };

            if (store.vimMode === 'normal') {
                switch (e.key) {
                    case 'j': case 'ArrowDown': moveCursor(1); break;
                    case 'k': case 'ArrowUp': moveCursor(-1); break;
                    case 'h': case 'ArrowLeft': store.navigateBack(); break;
                    case 'l': case 'ArrowRight': case 'Enter':
                        if (store.cursorPath) {
                            if (store.cursorPath === '..') {
                                store.navigateBack();
                            } else {
                                store.navigateInto(store.cursorPath);
                            }
                        }
                        break;
                    case 'o':
                        if (store.cursorPath) {
                            const node = store.fileMap.get(store.cursorPath);
                            if (node && !node.is_dir) store.openPreview(store.cursorPath);
                        }
                        break;
                    case 'g': if (!e.repeat) goTo('first'); break;
                    case 'G': goTo('last'); break;
                    case 'v': case 'V':
                        if (store.cursorPath && store.cursorPath !== '..') store.setVimMode('visual');
                        break;
                    case 'y': yank(); break;
                    case 'd': del(); break;
                    case 'C': if (e.shiftKey) store.clearAll(); break;
                    case ' ': if (store.cursorPath && store.cursorPath !== '..') store.toggleSelection(store.cursorPath); break;
                    case 'Escape': store.setSelection(new Set()); break;
                }
            } else if (store.vimMode === 'visual') {
                switch (e.key) {
                    case 'j': case 'ArrowDown': moveCursor(1); break;
                    case 'k': case 'ArrowUp': moveCursor(-1); break;
                    case 'g': if (!e.repeat) goTo('first'); break;
                    case 'G': goTo('last'); break;
                    case 'y': yank(); break;
                    case 'd': del(); break;
                    case 'Escape': exitVisualMode(); break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [getCurrentView, updateVisualSelection]);
};

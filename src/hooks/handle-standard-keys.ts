import { RefObject } from 'react';
import { FileNode } from '@/lib/types';
import { useFileStore } from '@/stores/file-store';

type FileStore = ReturnType<typeof useFileStore.getState>;
type UpdateVisualSelection = (newCursorPath: string, view: FileNode[]) => void;

export const handleStandardKeys = (
    e: KeyboardEvent,
    view: FileNode[],
    storeRef: RefObject<FileStore>,
    updateVisualSelection: UpdateVisualSelection,
) => {
    const store = storeRef.current;

    const ctrlOrMeta = e.metaKey || e.ctrlKey;
    const { key } = e;

    const isHandledKey =
        /^(ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Enter|Escape| |Delete|Home|End)$/i.test(key) ||
        (ctrlOrMeta && /^(x|a|c|s|t|A|C|S|T|Enter|Delete)$/i.test(key));

    if (!isHandledKey) return;

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

    if (ctrlOrMeta) {
        switch (key.toLowerCase()) {
            case 'a': {
                const allPaths = new Set(view.map(item => item.path).filter(p => p !== '..'));
                store.setSelection(allPaths);
                return;
            }
            case 'c': {
                if (store.previewedFilePath) {
                    return;
                }
                if (store.selectedPaths.size === 0 && store.cursorPath && store.cursorPath !== '..') {
                    store.yankToClipboard(new Set([store.cursorPath]));
                } else {
                    store.yankToClipboard();
                }
                return;
            }
            case 's': {
                if (store.selectedPaths.size === 0 && store.cursorPath && store.cursorPath !== '..') {
                    store.saveToFile(new Set([store.cursorPath]));
                } else {
                    store.saveToFile();
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
            case 'x':
                console.log("Pressed ctrl+x");
                store.toggleSortByTokens();
                return;
        }
    }

    switch (key) {
        case 'ArrowDown':
            return moveAndSelect(1);
        case 'ArrowUp':
            return moveAndSelect(-1);
        case 'ArrowLeft':
            return store.navigateBack();
        case 'ArrowRight':
        case 'Enter':
            return handleEnterOrArrowRight();
        case 'Home':
            return goToIndex(0);
        case 'End':
            return goToIndex(view.length - 1);
        case ' ': {
            if (store.cursorPath && store.cursorPath !== '..') store.toggleSelection(store.cursorPath);
            return;
        }
        case 'Escape': {
            if (store.previewedFilePath) {
                store.closePreview();
            } else {
                store.setSelection(new Set());
                store.setVisualAnchor(null);
            }

            return;
        }
        case 'Delete': {
            handleDelete();
            return;
        }
        default:
            return;
    }
};

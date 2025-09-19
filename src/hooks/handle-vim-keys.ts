import { RefObject } from 'react';
import { FileNode } from '@/lib/types';
import { useFileStore } from '@/stores/file-store';
import { toast } from 'sonner';

type FileStore = ReturnType<typeof useFileStore.getState>;
type UpdateVisualSelection = (newCursorPath: string, view: FileNode[]) => void;

export const handleVimKeys = (
    e: KeyboardEvent,
    view: FileNode[],
    storeRef: RefObject<FileStore>,
    updateVisualSelection: UpdateVisualSelection,
) => {
    const store = storeRef.current;
    const isHandledKey = /^(w|j|k|h|l|G|g|v|V|y|d|s|C|o| |Enter|Escape|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/.test(e.key);
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

    const save = () => {
        if (store.selectedPaths.size > 0) store.saveToFile();
        else if (store.cursorPath && store.cursorPath !== '..') store.saveToFile(new Set([store.cursorPath]));
        exitVisualMode();
    };

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
            case 'j':
                moveCursor(1);
                break;
            case 'k':
                moveCursor(-1);
                break;
            case 'h':
                store.navigateBack();
                break;
            case 'l':
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
            case 'w':
                if (store.previewedFilePath) {
                    store.closePreview();
                }
            case 'g':
                if (!e.repeat) goTo('first');
                break;
            case 'G':
                goTo('last');
                break;
            case 'v':
            case 'V':
                if (store.cursorPath && store.cursorPath !== '..') store.setVimMode('visual');
                break;
            case 'y':
                if (store.previewedFilePath) {
                    const content = store.rootFiles.get(store.previewedFilePath);
                    if (content) {
                        navigator.clipboard.writeText(content)
                            .then(() => toast.success("File content copied to clipboard!"))
                            .catch(() => toast.error("Failed to copy content."));
                    }
                } else {
                    yank();
                }
                break;
            case 'd':
                del();
                break;
            case 's':
                save();
                break;
            case 'C':
                if (e.shiftKey) store.clearAll();
                break;
            case ' ':
                if (store.cursorPath && store.cursorPath !== '..') store.toggleSelection(store.cursorPath);
                break;
            case 'Escape':
                store.setSelection(new Set());
                break;
            default:
                break;
        }
    } else if (store.vimMode === 'visual') {
        switch (e.key) {
            case 'j':
            case 'ArrowDown':
                moveCursor(1);
                break;
            case 'k':
            case 'ArrowUp':
                moveCursor(-1);
                break;
            case 'g':
                if (!e.repeat) goTo('first');
                break;
            case 'G':
                goTo('last');
                break;
            case 'y':
                yank();
                break;
            case 'd':
                del();
                break;
            case 's':
                save();
                break;
            case 'Escape':
                exitVisualMode();
                break;
            default:
                break;
        }
    }
};

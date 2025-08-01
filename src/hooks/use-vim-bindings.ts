import { useEffect, useCallback, useRef } from 'react';
import { useFileStore } from '@/stores/file-store';
import { FileNode } from '@/lib/types';

/**
 * Implements Vim-style keyboard navigation for the file tree.
 */
export const useVimBindings = () => {
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
            if (view.length === 0 && !['Escape', 'C'].includes(e.key)) return;

            const isHandledKey = /^[jkhlGgvVydC ]|Enter|Escape|Arrow/.test(e.key);
            if (isHandledKey) e.preventDefault();

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
                        if (store.cursorPath) store.navigateInto(store.cursorPath);
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

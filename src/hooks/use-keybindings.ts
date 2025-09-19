import { useEffect, useCallback, useRef } from 'react';
import { useFileStore } from '@/stores/file-store';
import { FileNode } from '@/lib/types';
import { handleStandardKeys } from './handle-standard-keys';
import { handleVimKeys } from './handle-vim-keys';

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

            if (view.length === 0) return;

            // --- Mode-Specific Handlers ---
            if (store.settings.keybindingMode === 'vim') {
                handleVimKeys(e, view, storeRef, updateVisualSelection);
            } else {
                handleStandardKeys(e, view, storeRef, updateVisualSelection);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [getCurrentView, updateVisualSelection]);
};

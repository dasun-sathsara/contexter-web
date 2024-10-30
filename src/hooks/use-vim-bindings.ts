import { useEffect } from 'react';
import { useFileStore } from '@/stores/file-store';
import { FileNode } from '@/lib/types';

export const useVimBindings = () => {
    const {
        vimMode,
        setVimMode,
        cursorPath,
        setCursor,
        visualAnchorPath,
        setVisualAnchor,
        selectedPaths,
        setSelection,
        toggleSelection,
        selectAllBelow,
        navigateInto,
        navigateBack,
        yankToClipboard,
        deleteSelected,
        clearAll,
        fileTree,
        fileMap,
        currentFolderPath,
    } = useFileStore();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't interfere with inputs
            if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
                return;
            }

            const currentView: FileNode[] = currentFolderPath
                ? fileMap.get(currentFolderPath)?.children || []
                : fileTree;
            if (currentFolderPath) {
                currentView.unshift({ name: '..', path: '..', is_dir: true, children: [] });
            }

            const cursorIndex = currentView.findIndex((item) => item.path === cursorPath);

            const updateVisualSelection = (newCursorPath: string) => {
                if (vimMode !== 'visual' || !visualAnchorPath) return;

                const anchorIndex = currentView.findIndex((item) => item.path === visualAnchorPath);
                const newCursorIndex = currentView.findIndex((item) => item.path === newCursorPath);

                if (anchorIndex === -1 || newCursorIndex === -1) return;

                const start = Math.min(anchorIndex, newCursorIndex);
                const end = Math.max(anchorIndex, newCursorIndex);

                const newSelection = new Set<string>();
                for (let i = start; i <= end; i++) {
                    newSelection.add(currentView[i].path);
                }
                setSelection(newSelection);
            };

            const moveCursor = (delta: number) => {
                const newIndex = Math.max(0, Math.min(currentView.length - 1, cursorIndex + delta));
                const newCursorPath = currentView[newIndex]?.path;
                if (newCursorPath) {
                    setCursor(newCursorPath);
                    if (vimMode === 'visual') {
                        updateVisualSelection(newCursorPath);
                    }
                }
            };

            // --- Normal Mode ---
            if (vimMode === 'normal') {
                switch (e.key) {
                    case 'j':
                        e.preventDefault();
                        moveCursor(1);
                        break;
                    case 'k':
                        e.preventDefault();
                        moveCursor(-1);
                        break;
                    case 'g':
                        e.preventDefault();
                        setCursor(currentView[0]?.path || null);
                        break;
                    case 'G':
                        e.preventDefault();
                        setCursor(currentView[currentView.length - 1]?.path || null);
                        break;
                    case 'h':
                    case 'ArrowLeft':
                        e.preventDefault();
                        navigateBack();
                        break;
                    case 'l':
                    case 'ArrowRight':
                    case 'Enter':
                        e.preventDefault();
                        if (cursorPath === '..') navigateBack();
                        else if (cursorPath) navigateInto(cursorPath);
                        break;
                    case 'v':
                        e.preventDefault();
                        setVimMode('visual');
                        setVisualAnchor(cursorPath);
                        if (cursorPath) setSelection(new Set([cursorPath]));
                        break;
                    case 'V':
                        e.preventDefault();
                        setVimMode('visual');
                        setVisualAnchor(cursorPath);
                        selectAllBelow();
                        break;
                    case 'y':
                        e.preventDefault();
                        if (selectedPaths.size > 0) {
                            yankToClipboard();
                        } else if (cursorPath) {
                            setSelection(new Set([cursorPath]));
                            // A bit of a hack to make `yy` work
                            setTimeout(yankToClipboard, 50);
                        }
                        break;
                    case 'd':
                        e.preventDefault();
                        if (selectedPaths.size > 0) {
                            deleteSelected();
                        } else if (cursorPath) {
                            setSelection(new Set([cursorPath]));
                            setTimeout(deleteSelected, 50);
                        }
                        break;
                    case 'C':
                        e.preventDefault();
                        if (e.shiftKey) clearAll();
                        break;
                    case ' ': // Spacebar to select
                        e.preventDefault();
                        if (cursorPath) toggleSelection(cursorPath);
                        break;
                }
            }

            // --- Visual Mode ---
            else if (vimMode === 'visual') {
                switch (e.key) {
                    case 'j':
                    case 'k':
                        e.preventDefault();
                        moveCursor(e.key === 'j' ? 1 : -1);
                        break;
                    case 'g':
                        e.preventDefault();
                        if (cursorPath) updateVisualSelection(currentView[0]?.path);
                        setCursor(currentView[0]?.path || null);
                        break;
                    case 'G':
                        e.preventDefault();
                        if (cursorPath) updateVisualSelection(currentView[currentView.length - 1]?.path);
                        setCursor(currentView[currentView.length - 1]?.path || null);
                        break;
                    case 'y':
                        e.preventDefault();
                        yankToClipboard();
                        setVimMode('normal');
                        break;
                    case 'd':
                        e.preventDefault();
                        deleteSelected();
                        setVimMode('normal');
                        break;
                    case 'Escape':
                        e.preventDefault();
                        setVimMode('normal');
                        setSelection(new Set()); // Optionally clear selection on exit
                        break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        vimMode,
        cursorPath,
        fileTree,
        fileMap,
        currentFolderPath,
        visualAnchorPath,
        selectedPaths /* include all dependencies */,
    ]);
};

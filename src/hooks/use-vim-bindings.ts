import { useEffect, useCallback } from 'react';
import { useFileStore } from '@/stores/file-store';
import { FileNode } from '@/lib/types';

export const useVimBindings = () => {
    const store = useFileStore();
    const {
        vimMode,
        cursorPath,
        visualAnchorPath,
        selectedPaths,
        fileTree,
        fileMap,
        currentFolderPath,
        setVimMode,
        setCursor,
        setVisualAnchor,
        setSelection,
        navigateInto,
        navigateBack,
        yankToClipboard,
        deleteSelected,
        clearAll,
        toggleSelection,
    } = store;

    const getCurrentView = useCallback(() => {
        const baseView: FileNode[] = currentFolderPath
            ? fileMap.get(currentFolderPath)?.children || []
            : fileTree;
        if (currentFolderPath) {
            return [{ name: '..', path: '..', is_dir: true, children: [] }, ...baseView];
        }
        return baseView;
    }, [currentFolderPath, fileMap, fileTree]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
                return;
            }

            const currentView = getCurrentView();
            if (currentView.length === 0) return;

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
                const newIndex = Math.max(0, Math.min(currentView.length - 1, (cursorIndex === -1 ? 0 : cursorIndex) + delta));
                const newCursorPath = currentView[newIndex]?.path;
                if (newCursorPath) {
                    setCursor(newCursorPath);
                    if (vimMode === 'visual') {
                        updateVisualSelection(newCursorPath);
                    }
                }
            };

            const selectAllBelowAction = () => {
                if (!cursorPath) return;
                const startIndex = currentView.findIndex((item) => item.path === cursorPath);
                if (startIndex === -1) return;
                const newSelection = new Set<string>();
                for (let i = startIndex; i < currentView.length; i++) {
                    newSelection.add(currentView[i].path);
                }
                setSelection(newSelection);
                setCursor(currentView[currentView.length - 1]?.path || null);
            };

            // --- Normal Mode ---
            if (vimMode === 'normal') {
                switch (e.key) {
                    case 'j': e.preventDefault(); moveCursor(1); break;
                    case 'k': e.preventDefault(); moveCursor(-1); break;
                    case 'g': e.preventDefault(); setCursor(currentView[0]?.path || null); break;
                    case 'G': e.preventDefault(); setCursor(currentView[currentView.length - 1]?.path || null); break;
                    case 'h': case 'ArrowLeft': e.preventDefault(); navigateBack(); break;
                    case 'l': case 'ArrowRight': case 'Enter':
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
                        selectAllBelowAction();
                        break;
                    case 'y':
                        e.preventDefault();
                        if (selectedPaths.size > 0) {
                            yankToClipboard();
                        } else if (cursorPath) {
                            yankToClipboard(new Set([cursorPath]));
                            // Flash selection for feedback
                            setSelection(new Set([cursorPath]));
                            setTimeout(() => setSelection(new Set()), 200);
                        }
                        break;
                    case 'd':
                        e.preventDefault();
                        if (selectedPaths.size > 0) {
                            deleteSelected();
                        } else if (cursorPath) {
                            deleteSelected(new Set([cursorPath]));
                        }
                        break;
                    case 'C':
                        if (e.shiftKey) {
                            e.preventDefault();
                            if (confirm('Are you sure you want to clear all files? This cannot be undone.')) {
                                clearAll();
                            }
                        }
                        break;
                    case ' ':
                        e.preventDefault();
                        if (cursorPath) toggleSelection(cursorPath);
                        break;
                    case 'Escape':
                        e.preventDefault();
                        setSelection(new Set());
                        break;
                }
            }

            // --- Visual Mode ---
            else if (vimMode === 'visual') {
                switch (e.key) {
                    case 'j': case 'k':
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
                        deleteSelected(); // This action will also reset vim mode
                        break;
                    case 'Escape':
                        e.preventDefault();
                        setVimMode('normal');
                        setSelection(new Set());
                        break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        // Add ALL state and functions used in the effect to the dependency array
        // This is crucial to prevent stale state issues.
        vimMode, cursorPath, visualAnchorPath, selectedPaths, fileTree, fileMap,
        currentFolderPath, setVimMode, setCursor, setVisualAnchor, setSelection,
        navigateInto, navigateBack, yankToClipboard, deleteSelected, clearAll,
        toggleSelection, getCurrentView
    ]);
};

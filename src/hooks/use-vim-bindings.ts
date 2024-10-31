import { useEffect, useCallback, useRef } from 'react';
import { useFileStore } from '@/stores/file-store';
import { FileNode } from '@/lib/types';

/**
 * Custom hook for implementing Vim-style keyboard navigation
 * 
 * Features:
 * - Normal and Visual mode navigation
 * - Efficient cursor management with memoization
 * - Proper cleanup and event handling
 * - Extensible command system
 * - Performance optimizations for large file trees
 */
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

    // Use refs to avoid stale closures and unnecessary re-renders
    const storeRef = useRef(store);
    storeRef.current = store;

    // Memoized function to get current view with performance optimization
    const getCurrentView = useCallback((): FileNode[] => {
        const { currentFolderPath, fileMap, fileTree } = storeRef.current;

        if (!fileMap || !fileTree) {
            return [];
        }

        if (currentFolderPath) {
            const folder = fileMap.get(currentFolderPath);
            const children = folder?.children || [];

            // Add parent navigation entry only for non-root folders
            return [
                {
                    name: '..',
                    path: '..',
                    is_dir: true,
                    children: [],
                    token_count: 0
                },
                ...children
            ];
        }

        return fileTree || [];
    }, []);

    // Optimized cursor movement with bounds checking
    const moveCursor = useCallback((delta: number) => {
        const currentView = getCurrentView();
        if (currentView.length === 0) return;

        const { cursorPath, setCursor, vimMode, setSelection, visualAnchorPath } = storeRef.current;
        const currentIndex = cursorPath ? currentView.findIndex(item => item.path === cursorPath) : -1;
        const newIndex = Math.max(0, Math.min(currentView.length - 1, (currentIndex === -1 ? 0 : currentIndex) + delta));
        const newCursorPath = currentView[newIndex]?.path;

        if (newCursorPath && newCursorPath !== cursorPath) {
            setCursor(newCursorPath);

            // Update visual selection if in visual mode
            if (vimMode === 'visual' && visualAnchorPath) {
                updateVisualSelection(newCursorPath, currentView);
            }
        }
    }, [getCurrentView]);

    // Optimized visual selection update
    const updateVisualSelection = useCallback((newCursorPath: string, currentView?: FileNode[]) => {
        const { visualAnchorPath, setSelection } = storeRef.current;
        if (!visualAnchorPath) return;

        const view = currentView || getCurrentView();
        const anchorIndex = view.findIndex(item => item.path === visualAnchorPath);
        const newCursorIndex = view.findIndex(item => item.path === newCursorPath);

        if (anchorIndex === -1 || newCursorIndex === -1) return;

        const start = Math.min(anchorIndex, newCursorIndex);
        const end = Math.max(anchorIndex, newCursorIndex);

        const newSelection = new Set<string>();
        for (let i = start; i <= end; i++) {
            const path = view[i]?.path;
            if (path && path !== '..') {  // Exclude parent navigation entry
                newSelection.add(path);
            }
        }
        setSelection(newSelection);
    }, [getCurrentView]);

    // Enhanced command handlers with better organization
    const commandHandlers = useCallback(() => {
        const currentView = getCurrentView();
        const {
            vimMode, cursorPath, setCursor, setVimMode, setVisualAnchor,
            setSelection, navigateInto, navigateBack, yankToClipboard,
            deleteSelected, clearAll, toggleSelection, selectedPaths
        } = storeRef.current;

        return {
            // Navigation commands
            moveDown: () => moveCursor(1),
            moveUp: () => moveCursor(-1),
            goToFirst: () => {
                const firstPath = currentView[0]?.path;
                if (firstPath) {
                    setCursor(firstPath);
                    if (vimMode === 'visual') {
                        updateVisualSelection(firstPath, currentView);
                    }
                }
            },
            goToLast: () => {
                const lastPath = currentView[currentView.length - 1]?.path;
                if (lastPath) {
                    setCursor(lastPath);
                    if (vimMode === 'visual') {
                        updateVisualSelection(lastPath, currentView);
                    }
                }
            },
            navigateLeft: () => navigateBack(),
            navigateRight: () => {
                if (cursorPath === '..') {
                    navigateBack();
                } else if (cursorPath) {
                    navigateInto(cursorPath);
                }
            },

            // Helper functions (define first to be used in other functions)
            selectAllBelow: () => {
                if (!cursorPath) return;
                const startIndex = currentView.findIndex(item => item.path === cursorPath);
                if (startIndex === -1) return;

                const newSelection = new Set<string>();
                for (let i = startIndex; i < currentView.length; i++) {
                    const path = currentView[i]?.path;
                    if (path && path !== '..') {
                        newSelection.add(path);
                    }
                }
                setSelection(newSelection);

                const lastPath = currentView[currentView.length - 1]?.path;
                if (lastPath) {
                    setCursor(lastPath);
                }
            },

            // Mode switching commands
            enterVisualMode: () => {
                if (cursorPath) {
                    setVimMode('visual');
                    setVisualAnchor(cursorPath);
                    setSelection(new Set([cursorPath]));
                }
            },
            enterVisualLineMode: () => {
                if (cursorPath) {
                    setVimMode('visual');
                    setVisualAnchor(cursorPath);
                    // Use the selectAllBelow function defined above
                    const startIndex = currentView.findIndex(item => item.path === cursorPath);
                    if (startIndex !== -1) {
                        const newSelection = new Set<string>();
                        for (let i = startIndex; i < currentView.length; i++) {
                            const path = currentView[i]?.path;
                            if (path && path !== '..') {
                                newSelection.add(path);
                            }
                        }
                        setSelection(newSelection);

                        const lastPath = currentView[currentView.length - 1]?.path;
                        if (lastPath) {
                            setCursor(lastPath);
                        }
                    }
                }
            },
            exitVisualMode: () => {
                setVimMode('normal');
                setSelection(new Set());
            },

            // Action commands
            yankSelection: () => {
                if (selectedPaths.size > 0) {
                    yankToClipboard();
                } else if (cursorPath && cursorPath !== '..') {
                    yankToClipboard(new Set([cursorPath]));
                    // Provide visual feedback
                    setSelection(new Set([cursorPath]));
                    setTimeout(() => setSelection(new Set()), 200);
                }
            },
            deleteSelection: () => {
                if (selectedPaths.size > 0) {
                    deleteSelected();
                } else if (cursorPath && cursorPath !== '..') {
                    deleteSelected(new Set([cursorPath]));
                }
            },
            toggleCurrentSelection: () => {
                if (cursorPath && cursorPath !== '..') {
                    toggleSelection(cursorPath);
                }
            },
            clearAllFiles: () => {
                if (confirm('Are you sure you want to clear all files? This cannot be undone.')) {
                    clearAll();
                }
            },
        };
    }, [getCurrentView, moveCursor, updateVisualSelection]);

    // Main keyboard event handler with improved performance
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Skip if typing in form elements
            const target = e.target as HTMLElement;
            const isFormElement = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
                target.contentEditable === 'true';

            if (isFormElement) {
                return;
            }

            const currentView = getCurrentView();
            if (currentView.length === 0) return;

            const handlers = commandHandlers();
            const { vimMode } = storeRef.current;

            // Prevent default for all handled keys
            const preventDefaultKeys = [
                'j', 'k', 'h', 'l', 'g', 'G', 'v', 'V', 'y', 'd', 'C',
                'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', ' '
            ];

            const shouldPreventDefault = preventDefaultKeys.includes(e.key) ||
                (e.key === 'C' && e.shiftKey);

            if (shouldPreventDefault) {
                e.preventDefault();
            }

            // Normal mode commands
            if (vimMode === 'normal') {
                switch (e.key) {
                    case 'j':
                    case 'ArrowDown':
                        handlers.moveDown();
                        break;
                    case 'k':
                    case 'ArrowUp':
                        handlers.moveUp();
                        break;
                    case 'h':
                    case 'ArrowLeft':
                        handlers.navigateLeft();
                        break;
                    case 'l':
                    case 'ArrowRight':
                    case 'Enter':
                        handlers.navigateRight();
                        break;
                    case 'g':
                        handlers.goToFirst();
                        break;
                    case 'G':
                        handlers.goToLast();
                        break;
                    case 'v':
                        handlers.enterVisualMode();
                        break;
                    case 'V':
                        handlers.enterVisualLineMode();
                        break;
                    case 'y':
                        handlers.yankSelection();
                        break;
                    case 'd':
                        handlers.deleteSelection();
                        break;
                    case 'C':
                        if (e.shiftKey) {
                            handlers.clearAllFiles();
                        }
                        break;
                    case ' ':
                        handlers.toggleCurrentSelection();
                        break;
                    case 'Escape':
                        handlers.exitVisualMode();
                        break;
                }
            }
            // Visual mode commands
            else if (vimMode === 'visual') {
                switch (e.key) {
                    case 'j':
                    case 'ArrowDown':
                        handlers.moveDown();
                        break;
                    case 'k':
                    case 'ArrowUp':
                        handlers.moveUp();
                        break;
                    case 'g':
                        handlers.goToFirst();
                        break;
                    case 'G':
                        handlers.goToLast();
                        break;
                    case 'y':
                        handlers.yankSelection();
                        handlers.exitVisualMode();
                        break;
                    case 'd':
                        handlers.deleteSelection();
                        break;
                    case 'Escape':
                        handlers.exitVisualMode();
                        break;
                }
            }
        };

        // Use passive: false to ensure preventDefault works
        window.addEventListener('keydown', handleKeyDown, { passive: false });

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []); // Empty dependency array since we use refs

    // Public API for programmatic control
    return {
        // Current state (read-only)
        currentView: getCurrentView(),
        vimMode,
        cursorPath,
        selectedPaths,

        // Actions
        moveCursor,
        goToPath: (path: string) => setCursor(path),
        enterVisualMode: () => {
            if (cursorPath) {
                setVimMode('visual');
                setVisualAnchor(cursorPath);
                setSelection(new Set([cursorPath]));
            }
        },
        exitVisualMode: () => {
            setVimMode('normal');
            setSelection(new Set());
        },

        // Utilities
        isValidPath: (path: string) => fileMap?.has(path) || false,
        getNodeAtPath: (path: string) => fileMap?.get(path),
    };
};

'use client';
import { FileNode } from '@/lib/types';
import { FileText, Folder, FolderOpen, ChevronLeft } from 'lucide-react';
import { useFileStore } from '@/stores/file-store';
import { cn } from '@/lib/utils';

interface FileTreeItemProps {
    item: FileNode;
    onDoubleClick?: () => void;
}

export function FileTreeItem({ item, onDoubleClick }: FileTreeItemProps) {
    const { cursorPath, setCursor, selectedPaths, navigateInto, settings } = useFileStore();

    const isCursor = cursorPath === item.path;
    const isSelected = selectedPaths.has(item.path);
    const isBack = item.path === '..';

    // Enhanced icon selection with state awareness
    const Icon = isBack ? ChevronLeft : item.is_dir ? (isCursor ? FolderOpen : Folder) : FileText;

    const handleDoubleClick = () => {
        if (onDoubleClick) {
            onDoubleClick();
        } else if (item.is_dir) {
            navigateInto(item.path);
        }
    };

    const handleClick = () => {
        setCursor(item.path);
    };

    const tokenDisplay = () => {
        if (!settings.showTokenCount || typeof item.token_count !== 'number') return null;
        return item.token_count >= 1000 ? `${(item.token_count / 1000).toFixed(1)}k` : item.token_count.toString();
    };

    return (
        <div
            className={cn(
                // Base styles with improved spacing
                'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm select-none',
                'transition-colors duration-150 ease-out',
                'hover:bg-muted/60',

                // Cursor state (primary focus indicator)
                isCursor && [
                    'bg-muted/80 border border-border/30',
                    'text-foreground',
                ],

                // Selection state (secondary indicator)
                isSelected && [
                    'bg-blue-50 dark:bg-blue-950/50',
                    'text-blue-900 dark:text-blue-100',
                    'border border-blue-500/30'
                ],

                // Combined cursor + selection state
                isCursor && isSelected && [
                    'bg-blue-100 dark:bg-blue-900/60',
                    'border border-blue-500/40'
                ],

                // Back button special styling
                isBack && [
                    'text-muted-foreground font-medium hover:text-foreground'
                ]
            )}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            data-path={item.path}
        >
            {/* Icon */}
            <div className="relative flex-shrink-0">
                <Icon className={cn(
                    'h-4 w-4 transition-colors duration-150',
                    isBack
                        ? 'text-muted-foreground'
                        : item.is_dir
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-muted-foreground',
                    isCursor && !isBack && 'text-foreground',
                    isSelected && !isBack && 'text-blue-700 dark:text-blue-300'
                )} />
            </div>

            {/* File/folder name */}
            <span className={cn(
                'truncate flex-grow transition-colors duration-150',
                item.is_dir && !isBack && 'font-medium',
                isBack && 'font-medium',
                isCursor && 'text-foreground',
                isSelected && !isBack && 'text-blue-900 dark:text-blue-100'
            )}>
                {isBack ? 'Back to parent' : item.name}
            </span>

            {/* Token count for files */}
            {settings.showTokenCount && !item.is_dir && (
                <span className={cn(
                    'text-xs px-2 py-1 rounded-md font-medium ml-auto bg-muted/60 text-muted-foreground',
                    'transition-colors duration-150',
                    isCursor && 'bg-primary/15 text-primary',
                    isSelected && 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                )}>
                    {tokenDisplay()}
                </span>
            )}

            {/* Token count for directories */}
            {settings.showTokenCount && item.is_dir && !isBack && (
                <span className={cn(
                    'text-xs px-2 py-1 rounded-md font-medium ml-auto bg-blue-500/15 text-blue-600 dark:text-blue-400',
                    'transition-colors duration-150',
                    isCursor && 'bg-blue-500/25 text-blue-700 dark:text-blue-300',
                    isSelected && 'bg-blue-500/30 text-blue-800 dark:text-blue-200'
                )}>
                    {tokenDisplay()}
                </span>
            )}

            {/* Selection indicator */}
            {isSelected && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-blue-500 rounded-r" />
            )}
        </div>
    );
}

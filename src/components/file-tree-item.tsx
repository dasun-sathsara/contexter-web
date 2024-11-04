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
                // Base styles with slightly larger design and subtle animations
                'group relative flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm select-none',
                'transition-all duration-200 ease-out',
                'hover:scale-[1.01] hover:shadow-sm',

                // Subtle hover state with enhanced background
                'hover:bg-muted/50',

                // Cursor state (primary focus indicator) with subtle glow
                isCursor && [
                    'bg-muted/70 shadow-sm',
                    'text-foreground',
                    'ring-1 ring-primary/20'
                ],

                // Selection state (secondary indicator) with enhanced visuals
                isSelected && [
                    'bg-blue-50 dark:bg-blue-950/40',
                    'text-blue-900 dark:text-blue-100',
                    'shadow-sm shadow-blue-500/10',
                    'ring-1 ring-blue-500/20'
                ],

                // Combined cursor + selection state
                isCursor && isSelected && [
                    'bg-blue-100 dark:bg-blue-900/50',
                    'shadow-md shadow-blue-500/20',
                    'ring-1 ring-blue-500/30'
                ],

                // Back button special styling
                isBack && [
                    'text-muted-foreground font-medium'
                ]
            )}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            data-path={item.path}
        >
            {/* Icon with enhanced styling and animations */}
            <div className="relative flex-shrink-0">
                <Icon className={cn(
                    'h-4 w-4 transition-all duration-200 ease-out',
                    'group-hover:scale-110',

                    // Base icon colors
                    isBack
                        ? 'text-muted-foreground'
                        : item.is_dir
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-muted-foreground',

                    // State colors with enhanced contrast
                    isCursor && !isBack && 'text-foreground scale-105',
                    isSelected && !isBack && 'text-blue-700 dark:text-blue-300 scale-105'
                )} />

                {/* Enhanced selection indicator with pulse animation */}
                {isSelected && !isBack && (
                    <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-sm shadow-blue-500/50" />
                )}
            </div>

            {/* File/folder name with enhanced typography and animations */}
            <span className={cn(
                'truncate flex-grow transition-all duration-200 ease-out',

                // Base typography
                item.is_dir && !isBack && 'font-medium',

                // Back button styling
                isBack && 'font-medium text-muted-foreground',

                // State typography with subtle transformations
                isCursor && 'text-foreground font-medium',
                isSelected && !isBack && 'text-blue-900 dark:text-blue-100 font-medium'
            )}>
                {isBack ? 'Back to parent' : item.name}
            </span>

            {/* Token count for files with enhanced styling */}
            {settings.showTokenCount && !item.is_dir && (
                <span className={cn(
                    'text-xs px-2 py-1 rounded-md font-medium ml-auto',
                    'bg-muted/60 text-muted-foreground',
                    'transition-all duration-200 ease-out',
                    'hover:scale-105',

                    // State colors with enhanced visibility
                    isCursor && 'bg-primary/15 text-primary shadow-sm',
                    isSelected && 'bg-blue-500/15 text-blue-600 dark:text-blue-400 shadow-sm shadow-blue-500/20'
                )}>
                    {tokenDisplay()}
                </span>
            )}

            {/* Token count for directories with enhanced styling */}
            {settings.showTokenCount && item.is_dir && !isBack && (
                <span className={cn(
                    'text-xs px-2 py-1 rounded-md font-medium ml-auto',
                    'bg-blue-500/15 text-blue-600 dark:text-blue-400',
                    'transition-all duration-200 ease-out',
                    'hover:scale-105 shadow-sm',

                    // State colors with enhanced visibility
                    isCursor && 'bg-blue-500/25 text-blue-700 dark:text-blue-300 shadow-md',
                    isSelected && 'bg-blue-500/30 text-blue-800 dark:text-blue-200 shadow-md shadow-blue-500/30'
                )}>
                    {tokenDisplay()}
                </span>
            )}

            {/* Enhanced selection indicator line with gradient */}
            {isSelected && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-gradient-to-b from-blue-400 to-blue-600 rounded-r shadow-sm" />
            )}
        </div>
    );
}

'use client';
import { FileNode } from '@/lib/types';
import { File, Folder, FolderOpen, ArrowUpLeft } from 'lucide-react';
import { useFileStore } from '@/stores/file-store';
import { cn } from '@/lib/utils';

interface FileTreeItemProps {
    item: FileNode;
    onDoubleClick?: () => void;
}

export function FileTreeItem({ item, onDoubleClick }: FileTreeItemProps) {
    const { cursorPath, setCursor, selectedPaths, toggleSelection, navigateInto, settings } = useFileStore();

    const isCursor = cursorPath === item.path;
    const isSelected = selectedPaths.has(item.path);
    const isBack = item.path === '..';

    // Better icon selection
    const Icon = isBack ? ArrowUpLeft : item.is_dir ? (isCursor ? FolderOpen : Folder) : File;

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
                'group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-all duration-200 select-none',
                'hover:bg-accent/50 hover:scale-[1.01] active:scale-[0.99]',
                isCursor && 'bg-accent border border-border shadow-sm',
                isSelected && 'bg-blue-500/15 dark:bg-blue-500/25 ring-1 ring-blue-500/50 shadow-sm',
                isCursor && isSelected && 'ring-2 ring-blue-600/70 bg-blue-500/20',
                isBack && 'border-l-2 border-l-muted-foreground/30 bg-muted/30'
            )}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            data-path={item.path}
        >
            <Icon className={cn(
                'h-4 w-4 flex-shrink-0 transition-colors duration-200',
                isBack
                    ? 'text-muted-foreground group-hover:text-foreground'
                    : item.is_dir
                        ? 'text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300'
                        : 'text-muted-foreground group-hover:text-foreground',
                isCursor && !isBack && 'text-foreground'
            )} />

            <span className={cn(
                'truncate flex-grow transition-colors duration-200',
                isBack && 'font-medium text-muted-foreground group-hover:text-foreground',
                item.is_dir && !isBack && 'font-medium',
                isCursor && 'text-foreground'
            )}>
                {isBack ? 'Back to parent' : item.name}
            </span>

            {settings.showTokenCount && !item.is_dir && (
                <span className={cn(
                    'text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground ml-auto transition-all duration-200',
                    'group-hover:bg-muted-foreground/10 group-hover:text-foreground',
                    isCursor && 'bg-primary/10 text-primary font-medium'
                )}>
                    {tokenDisplay()}
                </span>
            )}

            {settings.showTokenCount && item.is_dir && !isBack && (
                <span className={cn(
                    'text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 ml-auto transition-all duration-200',
                    'group-hover:bg-blue-500/20',
                    isCursor && 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                )}>
                    {tokenDisplay()}
                </span>
            )}
        </div>
    );
}

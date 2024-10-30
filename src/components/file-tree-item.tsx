'use client';
import { FileNode } from '@/lib/types';
import { File, Folder, FolderOpen } from 'lucide-react';
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
    const Icon = isBack ? FolderOpen : item.is_dir ? Folder : File;

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
                'flex items-center gap-2 p-1.5 rounded-md cursor-pointer text-sm',
                isCursor && 'bg-accent',
                isSelected && 'bg-blue-500/20 dark:bg-blue-500/30 ring-1 ring-blue-500',
                isCursor && isSelected && 'ring-2 ring-blue-600'
            )}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            data-path={item.path}
        >
            <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <span className="truncate flex-grow">{item.name}</span>
            {settings.showTokenCount && !item.is_dir && (
                <span className="text-xs text-muted-foreground ml-auto">{tokenDisplay()}</span>
            )}
            {settings.showTokenCount && item.is_dir && !isBack && (
                <span className="text-xs font-semibold text-muted-foreground/80 ml-auto">{tokenDisplay()}</span>
            )}
        </div>
    );
}

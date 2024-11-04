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
                // Base styles with enhanced spacing and modern feel
                'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm select-none',
                'transition-all duration-200 ease-out',

                // Hover states with subtle elevation
                'hover:bg-accent/70 hover:shadow-sm hover:scale-[1.01]',
                'hover:border-accent-foreground/10 hover:border',

                // Cursor state (primary focus indicator)
                isCursor && [
                    'bg-accent/90 border border-accent-foreground/15',
                    'shadow-sm ring-1 ring-accent-foreground/20',
                    'scale-[1.01]'
                ],

                // Selection state (secondary indicator)
                isSelected && [
                    'bg-gradient-to-r from-blue-500/10 via-blue-500/15 to-blue-500/10',
                    'border-blue-500/25 ring-1 ring-blue-500/30',
                    !isCursor && 'shadow-sm'
                ],

                // Combined cursor + selection state (enhanced visibility)
                isCursor && isSelected && [
                    'bg-gradient-to-r from-blue-500/20 via-blue-500/25 to-blue-500/20',
                    'ring-2 ring-blue-600/40 border-blue-500/40',
                    'shadow-md'
                ],

                // Back button special styling
                isBack && [
                    'border-l-2 border-l-muted-foreground/30',
                    'bg-gradient-to-r from-muted/50 to-muted/30',
                    'hover:from-muted/70 hover:to-muted/50',
                    'font-medium'
                ],

                // Active/pressed state
                'active:scale-[0.99] active:shadow-inner'
            )}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            data-path={item.path}
        >
            {/* Icon with enhanced animations */}
            <div className="relative flex-shrink-0">
                <Icon className={cn(
                    'h-4 w-4 transition-all duration-200 ease-out',

                    // Base icon colors
                    isBack
                        ? 'text-muted-foreground'
                        : item.is_dir
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-muted-foreground',

                    // Enhanced state colors
                    isCursor && !isBack && 'text-foreground scale-110',
                    isSelected && !isBack && 'text-blue-700 dark:text-blue-300',

                    // Hover effects
                    'group-hover:scale-105',
                    isBack && 'group-hover:text-foreground group-hover:translate-x-0.5'
                )} />

                {/* Selection indicator dot */}
                {isSelected && !isBack && (
                    <div className={cn(
                        'absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full',
                        'bg-blue-500 ring-1 ring-background',
                        'animate-in zoom-in-50 duration-200',
                        isCursor && 'bg-blue-600 scale-110'
                    )} />
                )}
            </div>

            {/* File/folder name with enhanced typography */}
            <span className={cn(
                'truncate flex-grow transition-all duration-200 ease-out',

                // Base typography
                item.is_dir && !isBack && 'font-medium',

                // Back button styling
                isBack && 'font-semibold text-muted-foreground',

                // Enhanced state typography
                isCursor && 'text-foreground font-medium',
                isSelected && !isBack && 'text-blue-900 dark:text-blue-100',

                // Subtle hover effects
                'group-hover:text-foreground'
            )}>
                {isBack ? 'Back to parent' : item.name}
            </span>

            {/* Token count badges with improved design */}
            {settings.showTokenCount && !item.is_dir && (
                <div className={cn(
                    'flex items-center ml-auto transition-all duration-200',
                    'animate-in slide-in-from-right-2 duration-300'
                )}>
                    <span className={cn(
                        'text-xs px-2.5 py-1 rounded-full font-medium',
                        'bg-muted/80 text-muted-foreground',
                        'border border-muted-foreground/10',
                        'transition-all duration-200',

                        // Enhanced states
                        isCursor && [
                            'bg-primary/15 text-primary border-primary/25',
                            'shadow-sm scale-105'
                        ],
                        isSelected && [
                            'bg-blue-500/15 text-blue-700 dark:text-blue-300',
                            'border-blue-500/25'
                        ],

                        // Hover effects
                        'group-hover:bg-accent group-hover:scale-105'
                    )}>
                        {tokenDisplay()}
                    </span>
                </div>
            )}

            {/* Directory token count with special styling */}
            {settings.showTokenCount && item.is_dir && !isBack && (
                <div className={cn(
                    'flex items-center ml-auto transition-all duration-200',
                    'animate-in slide-in-from-right-2 duration-300'
                )}>
                    <span className={cn(
                        'text-xs font-semibold px-2.5 py-1 rounded-full',
                        'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                        'border border-blue-500/20',
                        'transition-all duration-200',

                        // Enhanced states
                        isCursor && [
                            'bg-blue-500/20 text-blue-700 dark:text-blue-300',
                            'border-blue-500/30 shadow-sm scale-105'
                        ],
                        isSelected && [
                            'bg-blue-500/25 text-blue-800 dark:text-blue-200',
                            'border-blue-500/40 shadow-sm'
                        ],

                        // Hover effects
                        'group-hover:bg-blue-500/20 group-hover:scale-105'
                    )}>
                        {tokenDisplay()}
                    </span>
                </div>
            )}

            {/* Subtle selection indicator line */}
            {isSelected && (
                <div className={cn(
                    'absolute left-0 top-1/2 -translate-y-1/2',
                    'w-1 h-4 bg-blue-500 rounded-r-full',
                    'animate-in slide-in-from-left-1 duration-200',
                    isCursor && 'bg-blue-600 h-6'
                )} />
            )}
        </div>
    );
}

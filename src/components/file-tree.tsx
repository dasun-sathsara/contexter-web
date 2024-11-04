'use client';

import { FileNode } from '@/lib/types';
import { ScrollArea } from './ui/scroll-area';
import { FileTreeItem } from './file-tree-item';
import { useFileStore } from '@/stores/file-store';
import { Loader2, FolderTree, FileIcon } from 'lucide-react';

interface FileTreeProps {
    items: FileNode[];
}

export function FileTree({ items }: FileTreeProps) {
    const { currentFolderPath, navigateBack, isLoading } = useFileStore();

    if (isLoading) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/5 rounded-lg border border-border/50 animate-in fade-in-50 duration-500">
                <div className="flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-500">
                    <Loader2 className="h-6 w-6 animate-spin text-primary/80" />
                    <span className="text-sm font-medium">Processing files...</span>
                </div>
                <p className="mt-3 text-xs text-center max-w-sm text-muted-foreground/70 animate-in fade-in-50 duration-700 delay-200">
                    Analyzing your project structure
                </p>
                {/* Enhanced progress indicator with pulse animation */}
                <div className="mt-4 w-32 h-1 bg-muted/40 rounded-full overflow-hidden animate-in slide-in-from-bottom-1 duration-700 delay-300">
                    <div className="h-full bg-gradient-to-r from-primary/60 to-primary/80 rounded-full animate-pulse shadow-sm shadow-primary/20" style={{ width: '70%' }} />
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-card rounded-lg border border-border/50 overflow-hidden animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
            {/* Enhanced Header with subtle animations */}
            <div className="flex items-center gap-3 p-4 border-b border-border/50 bg-gradient-to-r from-card to-muted/20">
                <FolderTree className="h-4 w-4 text-primary/80 animate-pulse" />
                <h3 className="font-medium text-sm text-foreground">
                    {currentFolderPath ? 'Folder Contents' : 'Project Structure'}
                </h3>
                <div className="ml-auto">
                    <span className="text-xs px-2.5 py-1 bg-muted/50 text-muted-foreground rounded-md font-medium shadow-sm transition-all duration-200 hover:scale-105">
                        {items.length}
                    </span>
                </div>
            </div>

            {/* Content Area with enhanced animations */}
            <ScrollArea className="flex-grow">
                <div className="p-3">
                    <div className="space-y-1">
                        {/* Back navigation */}
                        {currentFolderPath && (
                            <div className="mb-3 animate-in slide-in-from-top-1 duration-300">
                                <FileTreeItem
                                    item={{ path: '..', name: '..', is_dir: true, children: [] }}
                                    onDoubleClick={() => navigateBack()}
                                />
                            </div>
                        )}

                        {/* Empty state */}
                        {items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground animate-in fade-in-50 duration-500">
                                <FileIcon className="h-16 w-16 opacity-20 mb-4 animate-pulse" />
                                <p className="text-sm font-medium mb-2">No items to display</p>
                                <p className="text-xs opacity-60 text-center max-w-48">
                                    This folder appears to be empty
                                </p>
                            </div>
                        ) : (
                            /* File list with staggered animations */
                            <div className="space-y-1 animate-in fade-in-50 duration-300">
                                {items.map((item, index) => (
                                    <div
                                        key={`${item.path}-${index}`}
                                        className="animate-in slide-in-from-left-1 duration-300"
                                        style={{
                                            animationDelay: `${index * 30}ms`,
                                            animationFillMode: 'both'
                                        }}
                                    >
                                        <FileTreeItem item={item} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}

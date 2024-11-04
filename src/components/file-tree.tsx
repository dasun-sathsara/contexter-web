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
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/5 rounded-lg border border-border/50">
                <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary/80" />
                    <span className="text-sm font-medium">Processing files...</span>
                </div>
                <p className="mt-2 text-xs text-center max-w-sm text-muted-foreground/70">
                    Analyzing your project structure
                </p>
                {/* Minimal progress indicator */}
                <div className="mt-3 w-24 h-0.5 bg-muted/30 rounded-full overflow-hidden">
                    <div className="h-full bg-primary/60 rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-card rounded-lg border border-border/50 overflow-hidden">
            {/* Minimal Header */}
            <div className="flex items-center gap-3 p-3 border-b border-border/50">
                <FolderTree className="h-4 w-4 text-primary/80" />
                <h3 className="font-medium text-sm text-foreground">
                    {currentFolderPath ? 'Folder Contents' : 'Project Structure'}
                </h3>
                <div className="ml-auto">
                    <span className="text-xs px-2 py-0.5 bg-muted/40 text-muted-foreground rounded font-medium">
                        {items.length}
                    </span>
                </div>
            </div>

            {/* Content Area */}
            <ScrollArea className="flex-grow">
                <div className="p-2">
                    <div className="space-y-0.5">
                        {/* Back navigation */}
                        {currentFolderPath && (
                            <div className="mb-2">
                                <FileTreeItem
                                    item={{ path: '..', name: '..', is_dir: true, children: [] }}
                                    onDoubleClick={() => navigateBack()}
                                />
                            </div>
                        )}

                        {/* Empty state */}
                        {items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <FileIcon className="h-12 w-12 opacity-20 mb-3" />
                                <p className="text-sm font-medium mb-1">No items to display</p>
                                <p className="text-xs opacity-60 text-center max-w-48">
                                    This folder appears to be empty
                                </p>
                            </div>
                        ) : (
                            /* File list */
                            <div className="space-y-0.5">
                                {items.map((item, index) => (
                                    <FileTreeItem key={`${item.path}-${index}`} item={item} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}

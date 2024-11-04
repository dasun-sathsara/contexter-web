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
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-gradient-to-br from-muted/10 via-muted/20 to-muted/10 rounded-lg border border-dashed border-muted-foreground/20">
                <div className="flex items-center gap-3 animate-in fade-in-50 duration-500">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="text-base font-medium">Processing files...</span>
                </div>
                <p className="mt-3 text-sm text-center max-w-sm opacity-80 animate-in fade-in-50 duration-700 delay-200">
                    Analyzing your project structure
                </p>
                {/* Subtle progress indicator */}
                <div className="mt-4 w-32 h-1 bg-muted/50 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary/60 to-primary bg-primary/80 rounded-full animate-pulse"
                        style={{ width: '60%' }} />
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-card rounded-lg border shadow-sm overflow-hidden animate-in fade-in-50 duration-300">
            {/* Enhanced Header */}
            <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-muted/20 via-muted/30 to-muted/20 backdrop-blur-sm">
                <div className="relative">
                    <FolderTree className="h-4 w-4 text-primary transition-transform duration-200 group-hover:scale-110" />
                    <div className="absolute -inset-1 bg-primary/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </div>
                <h3 className="font-semibold text-sm text-foreground">
                    {currentFolderPath ? 'Folder Contents' : 'Project Structure'}
                </h3>
                <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs px-2 py-1 bg-muted/50 text-muted-foreground rounded-full border border-muted-foreground/10 font-medium">
                        {items.length} {items.length === 1 ? 'item' : 'items'}
                    </span>
                </div>
            </div>

            {/* Enhanced Content Area */}
            <ScrollArea className="flex-grow">
                <div className="p-4">
                    <div className="flex flex-col gap-1">
                        {/* Back navigation with special styling */}
                        {currentFolderPath && (
                            <div className="mb-3 animate-in slide-in-from-left-2 duration-300">
                                <FileTreeItem
                                    item={{ path: '..', name: '..', is_dir: true, children: [] }}
                                    onDoubleClick={() => navigateBack()}
                                />
                            </div>
                        )}

                        {/* Empty state with enhanced design */}
                        {items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground animate-in fade-in-50 duration-500">
                                <div className="relative mb-4">
                                    <FileIcon className="h-16 w-16 opacity-30" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-muted/20 to-transparent rounded-full blur-xl" />
                                </div>
                                <p className="text-sm font-medium mb-2">No items to display</p>
                                <p className="text-xs opacity-70 text-center max-w-48">
                                    This folder appears to be empty or all items are filtered out
                                </p>
                            </div>
                        ) : (
                            /* File list with staggered animations */
                            <div className="space-y-1">
                                {items.map((item, index) => (
                                    <div
                                        key={`${item.path}-${index}`}
                                        className="animate-in slide-in-from-left-2 duration-300"
                                        style={{
                                            animationDelay: `${Math.min(index * 50, 500)}ms`,
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

'use client';

import { FileNode } from '@/lib/types';
import { ScrollArea } from './ui/scroll-area';
import { FileTreeItem } from './file-tree-item';
import { useFileStore } from '@/stores/file-store';
import { Loader2, FolderTree } from 'lucide-react';

interface FileTreeProps {
    items: FileNode[];
}

export function FileTree({ items }: FileTreeProps) {
    const { currentFolderPath, navigateBack, isLoading } = useFileStore();

    if (isLoading) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                <div className="flex items-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="text-lg font-medium">Processing files...</span>
                </div>
                <p className="mt-2 text-sm text-center max-w-sm">
                    Analyzing your project structure and calculating token counts
                </p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-card rounded-lg border shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-2 p-4 border-b bg-muted/30 rounded-t-lg">
                <FolderTree className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm text-foreground">
                    {currentFolderPath ? 'Folder Contents' : 'Project Structure'}
                </h3>
                <div className="ml-auto text-xs text-muted-foreground">
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                </div>
            </div>

            {/* Content */}
            <ScrollArea className="flex-grow p-4">
                <div className="flex flex-col gap-1">
                    {currentFolderPath && (
                        <div className="mb-2">
                            <FileTreeItem
                                item={{ path: '..', name: '..', is_dir: true, children: [] }}
                                onDoubleClick={() => navigateBack()}
                            />
                        </div>
                    )}

                    {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <FolderTree className="h-12 w-12 mb-3 opacity-50" />
                            <p className="text-sm font-medium">No items to display</p>
                            <p className="text-xs mt-1">This folder appears to be empty</p>
                        </div>
                    ) : (
                        items.map((item, index) => (
                            <FileTreeItem
                                key={`${item.path}-${index}`}
                                item={item}
                            />
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

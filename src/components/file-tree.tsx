'use client';

import { FileNode } from '@/lib/types';
import { ScrollArea } from './ui/scroll-area';
import { FileTreeItem } from './file-tree-item';
import { useFileStore } from '@/stores/file-store';
import { Loader2 } from 'lucide-react';

interface FileTreeProps {
    items: FileNode[];
}

export function FileTree({ items }: FileTreeProps) {
    const { currentFolderPath, navigateBack, isLoading } = useFileStore();

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mr-2" />
                Processing...
            </div>
        );
    }

    return (
        <ScrollArea className="h-full w-full rounded-md border p-2">
            <div className="flex flex-col">
                {currentFolderPath && (
                    <FileTreeItem
                        item={{ path: '..', name: '..', is_dir: true, children: [] }}
                        onDoubleClick={() => navigateBack()}
                    />
                )}
                {items.map((item) => (
                    <FileTreeItem key={item.path} item={item} />
                ))}
            </div>
        </ScrollArea>
    );
}

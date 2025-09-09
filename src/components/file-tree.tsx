'use client';

import { FileNode } from '@/lib/types';
import { ScrollArea } from './ui/scroll-area';
import { FileTreeItem } from './file-tree-item';
import { useFileStore } from '@/stores/file-store';
import { FolderTree, FileIcon } from 'lucide-react';
import { LoadingSpinner } from './ui/loading-spinner';
import { useEffect, useRef } from 'react';

interface FileTreeProps {
  items: FileNode[];
}

export function FileTree({ items }: FileTreeProps) {
  const { currentFolderPath, navigateBack, isLoading, cursorPath } = useFileStore();
  const containerRef = useRef<HTMLDivElement>(null);


  // Scroll to the item with the cursorPath when it changes
  useEffect(() => {
    if (containerRef.current && cursorPath) {
      const selector = `[data-path="${CSS.escape(cursorPath)}"]`
      const element = containerRef.current.querySelector<HTMLElement>(selector);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [cursorPath])

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/5 rounded-lg border border-border/50">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner size="lg" />
          <div className="text-center">
            <p className="text-sm font-medium animate-in fade-in-50 duration-500">
              Processing files...
            </p>
            <p className="mt-2 text-xs text-muted-foreground/70 animate-in fade-in-50 slide-in-from-bottom-1 duration-700 [animation-delay:200ms]">
              Analyzing your project structure
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-card rounded-lg border border-border/50 overflow-hidden shadow-sm transition-colors duration-300">
      <div className="flex items-center gap-3 p-5 border-b border-border/50 bg-gradient-to-r from-card to-muted/10 transition-colors duration-300">
        <FolderTree className="h-5 w-5 text-primary/80 transition-colors duration-300" />
        <h3 className="font-semibold text-sm text-foreground transition-colors duration-300">
          {currentFolderPath ? 'Folder Contents' : 'Project Structure'}
        </h3>
        <div className="ml-auto">
          <span className="text-xs px-3 py-1.5 bg-muted/60 text-muted-foreground rounded-md font-medium shadow-sm border border-border/30 transition-colors duration-300">
            {items.length}
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0" ref={containerRef}>
        <div className="p-4">
          <div className="space-y-1">
            {currentFolderPath && (
              <div className="mb-3">
                <FileTreeItem
                  item={{ path: '..', name: '..', is_dir: true, children: [] }}
                  onDoubleClick={() => navigateBack()}
                />
              </div>
            )}

            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground transition-colors duration-300">
                <FileIcon className="h-20 w-20 opacity-20 mb-4 transition-colors duration-300" />
                <p className="text-sm font-medium mb-2 transition-colors duration-300">No items to display</p>
                <p className="text-xs opacity-60 text-center max-w-48 transition-colors duration-300">
                  This folder appears to be empty
                </p>
              </div>
            ) : (
              <div className="space-y-1">
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

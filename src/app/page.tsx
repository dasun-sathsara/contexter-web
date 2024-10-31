'use client';

import { ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { DropZone } from '@/components/drop-zone';
import { FileTree } from '@/components/file-tree';
import { Header } from '@/components/header';
import { StatusBar } from '@/components/status-bar';
import { useFileStore } from '@/stores/file-store';
import { useVimBindings } from '@/hooks/use-vim-bindings';
import { FileNode } from '@/lib/types';

export default function HomePage() {
    useVimBindings();
    const { fileTree, currentFolderPath, fileMap, isLoading } = useFileStore();

    const currentView: FileNode[] = currentFolderPath ? fileMap.get(currentFolderPath)?.children || [] : fileTree;

    const showDropZone = fileTree.length === 0 && !isLoading;

    return (
        <div className="flex flex-col h-screen bg-gradient-to-br from-background via-background to-muted/20">
            <Header />
            <main className="flex-grow overflow-hidden">
                <ResizablePanelGroup direction="horizontal" className="h-full">
                    <ResizablePanel defaultSize={100}>
                        <div className="h-full flex flex-col p-6 pt-4">
                            <div className="flex-grow min-h-0">
                                {showDropZone ? <DropZone /> : <FileTree items={currentView} />}
                            </div>
                        </div>
                    </ResizablePanel>
                    {/* Future panel for code preview if needed
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={50}>
            <div className="h-full p-4">
              <h2 className="text-lg font-semibold mb-2">Code Preview</h2>
              <div className="w-full h-[calc(100%-2rem)] bg-muted rounded-md p-2">
                Select a file to preview
              </div>
            </div>
          </ResizablePanel>
          */}
                </ResizablePanelGroup>
            </main>
            <StatusBar />
        </div>
    );
}

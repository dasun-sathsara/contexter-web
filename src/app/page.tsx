'use client';

import { ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { DropZone } from '@/components/drop-zone';
import { FileTree } from '@/components/file-tree';
import { Header } from '@/components/header';
import { StatusBar } from '@/components/status-bar';
import { useFileStore } from '@/stores/file-store';
import { useVimBindings } from '@/hooks/use-vim-bindings';
import { FileNode } from '@/lib/types';
import { LoadingOverlay } from '@/components/loading-overlay';

export default function HomePage() {
    useVimBindings();
    const { fileTree, currentFolderPath, fileMap, isLoading, statusMessage } = useFileStore();

    const currentView: FileNode[] = currentFolderPath ? fileMap.get(currentFolderPath)?.children || [] : fileTree;

    const showDropZone = fileTree.length === 0 && !isLoading;
    const showFileTree = fileTree.length > 0;
    const showLoadingTransition = isLoading && fileTree.length === 0;

    return (
        <div className="flex flex-col h-screen bg-background transition-colors duration-300">
            <Header />
            <main className="flex-grow overflow-hidden transition-colors duration-300 relative">
                <ResizablePanelGroup direction="horizontal" className="h-full">
                    <ResizablePanel defaultSize={100}>
                        <div className="h-full flex flex-col p-6 transition-colors duration-300">
                            <div className="flex-grow min-h-0 relative">
                                {/* Show DropZone when no files are loaded */}
                                {showDropZone && <DropZone />}
                                
                                {/* Show FileTree when files are loaded */}
                                {showFileTree && (
                                    <div className={`h-full transition-opacity duration-500 ${showLoadingTransition ? 'opacity-0' : 'opacity-100'}`}>
                                        <FileTree items={currentView} />
                                    </div>
                                )}
                                
                                {/* Show loading overlay during initial file processing when transitioning from DropZone */}
                                {showLoadingTransition && (
                                    <div className="h-full flex items-center justify-center">
                                        <LoadingOverlay 
                                            message={statusMessage || 'Processing files...'}
                                            subMessage="Building file structure"
                                            className="relative bg-transparent backdrop-blur-none"
                                        />
                                    </div>
                                )}
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

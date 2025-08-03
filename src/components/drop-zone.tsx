'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useFileStore } from '@/stores/file-store';
import { UploadCloud, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { LoadingOverlay } from './loading-overlay';

export function DropZone() {
    const { processFiles, processDroppedFiles, isLoading, statusMessage } = useFileStore();

    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            console.log('[DropZone] Files dropped:', acceptedFiles);
            console.log('[DropZone] Drop event data details:', {
                fileCount: acceptedFiles.length,
                files: acceptedFiles.map(file => ({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    lastModified: file.lastModified,
                    webkitRelativePath: file.webkitRelativePath || 'N/A',
                    path: (file as File & { path?: string }).path || 'N/A'
                }))
            });

            // Use the specialized method for dropped files to avoid expensive normalization
            processDroppedFiles(acceptedFiles);
        },
        [processDroppedFiles]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        noClick: true,
    });

    const handleFolderSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            const filesArray = Array.from(event.target.files);
            console.log('[DropZone] Folder selected:', filesArray);
            console.log('[DropZone] File dialog data details:', {
                fileCount: filesArray.length,
                files: filesArray.map(file => ({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    lastModified: file.lastModified,
                    webkitRelativePath: file.webkitRelativePath || 'N/A',
                    path: (file as File & { path?: string }).path || 'N/A'
                }))
            });
            processFiles(filesArray);
        }
    };

    return (
        <div
            {...getRootProps()}
            className={cn(
                'flex-grow flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl transition-all duration-300 ease-out',
                isDragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/30',
                'relative min-h-[400px]'
            )}
        >
            <input {...getInputProps()} />
            <input
                type="file"
                id="folder-upload"
                webkitdirectory=""
                multiple
                style={{ display: 'none' }}
                onChange={handleFolderSelect}
            />

            {isLoading && (
                <LoadingOverlay
                    message={statusMessage || 'Processing files...'}
                    subMessage="This may take a moment for large folders"
                />
            )}

            <div className={cn(
                "flex flex-col items-center text-center transition-opacity duration-300",
                isLoading && "opacity-0 pointer-events-none"
            )}>
                <UploadCloud className={cn(
                    'h-16 w-16 mb-6 transition-colors duration-300',
                    isDragActive ? 'text-primary' : 'text-muted-foreground'
                )} />

                <h2 className={cn(
                    'text-2xl font-semibold mb-3 transition-colors duration-300',
                    isDragActive ? 'text-primary' : 'text-foreground'
                )}>
                    {isDragActive ? 'Drop your files here!' : 'Drop Files or Folders'}
                </h2>

                <p className="text-muted-foreground mb-8 max-w-sm transition-colors duration-300">
                    {isDragActive
                        ? 'Release to process your files'
                        : 'Drag and drop your project files to get started'
                    }
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                    <Button variant="outline" asChild>
                        <label htmlFor="folder-upload" className="cursor-pointer transition-colors duration-300">
                            <Folder className="h-4 w-4 mr-2 transition-colors duration-300" />
                            Select Folder
                        </label>
                    </Button>
                </div>

                <div className="mt-8 text-xs text-muted-foreground/70 transition-colors duration-300">
                    Supports text files • Respects .gitignore • Processed locally
                </div>
            </div>
        </div>
    );
}

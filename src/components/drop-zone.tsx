'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useFileStore } from '@/stores/file-store';
import { UploadCloud, FolderPlus, MousePointer, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DropZone() {
    const { processFiles } = useFileStore();

    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            // Process all dropped files/folders consistently
            processFiles(acceptedFiles);
        },
        [processFiles]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        noClick: true, // We will prompt user to click a button for folder selection
    });

    // This allows selecting a folder manually
    const handleFolderSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            processFiles(Array.from(event.target.files));
        }
    };

    return (
        <div
            {...getRootProps()}
            className={cn(
                'flex-grow flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl transition-all duration-300 ease-out group',
                'animate-in fade-in-50 slide-in-from-bottom-4 duration-700',
                isDragActive
                    ? 'border-primary bg-primary/5 scale-[1.02] shadow-lg shadow-primary/10'
                    : 'border-border hover:border-muted-foreground/30 hover:bg-muted/20 hover:scale-[1.01]',
                'relative min-h-[400px]'
            )}
        >
            <input {...getInputProps()} />
            {/* Folder selection input, hidden but accessible via label click */}
            <input
                type="file"
                id="folder-upload"
                webkitdirectory=""
                multiple
                style={{ display: 'none' }}
                onChange={handleFolderSelect}
            />

            <div className="flex flex-col items-center animate-in slide-in-from-bottom-2 duration-500 delay-100">
                <div className="relative">
                    <UploadCloud className={cn(
                        'h-20 w-20 transition-all duration-300 ease-out',
                        isDragActive
                            ? 'text-primary scale-110 animate-pulse'
                            : 'text-muted-foreground group-hover:scale-105 group-hover:text-primary/70'
                    )} />
                    <Sparkles className="h-6 w-6 text-primary/60 absolute -top-1 -right-1 animate-pulse" />
                </div>

                <h2 className={cn(
                    'mt-6 text-3xl font-bold text-center transition-all duration-300',
                    isDragActive ? 'text-primary scale-105' : 'text-foreground'
                )}>
                    {isDragActive ? 'Drop your files here!' : 'Get Started with Your Project'}
                </h2>

                <p className="mt-3 text-base text-muted-foreground text-center max-w-md transition-all duration-200">
                    {isDragActive
                        ? 'Release to process your files and folders'
                        : 'Drag and drop your project folder or individual files to analyze their structure and generate context'
                    }
                </p>

                <div className="flex items-center gap-3 mt-8 animate-in slide-in-from-bottom-1 duration-500 delay-300">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MousePointer className="h-4 w-4" />
                        <span>Drag & drop</span>
                    </div>

                    <div className="w-px h-4 bg-border" />

                    <label
                        htmlFor="folder-upload"
                        className={cn(
                            'inline-flex items-center gap-2 px-6 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm transition-all duration-200',
                            'text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary cursor-pointer',
                            'hover:scale-105 hover:shadow-md active:scale-95'
                        )}
                    >
                        <FolderPlus className="h-4 w-4" />
                        Browse Folder
                    </label>
                </div>

                <div className="mt-6 text-xs text-muted-foreground/70 text-center animate-in fade-in-50 duration-500 delay-500">
                    Supports all text-based files • Respects .gitignore • Processes locally
                </div>
            </div>
        </div>
    );
}

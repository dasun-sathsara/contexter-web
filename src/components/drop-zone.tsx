'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useFileStore } from '@/stores/file-store';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DropZone() {
    const { processFiles, isLoading } = useFileStore();

    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            const directory = acceptedFiles.find((f) => (f as any).webkitRelativePath.includes('/'));
            if (directory) {
                processFiles(acceptedFiles);
            } else {
                // If only files are dropped, we can handle them as well
                processFiles(acceptedFiles);
            }
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
                'flex-grow flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg transition-colors',
                isDragActive ? 'border-primary bg-primary/10' : 'border-border',
                'relative'
            )}
        >
            <input {...getInputProps()} />
            {/* Folder selection input, hidden but accessible via label click */}
            <input
                type="file"
                id="folder-upload"
                webkitdirectory=""
                directory=""
                multiple
                style={{ display: 'none' }}
                onChange={handleFolderSelect}
            />

            <UploadCloud className="h-16 w-16 text-muted-foreground" />
            <h2 className="mt-4 text-2xl font-semibold">Drag & Drop Files or a Folder Here</h2>
            <p className="mt-2 text-muted-foreground">or</p>
            <label
                htmlFor="folder-upload"
                className="mt-2 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary cursor-pointer"
            >
                Select a Folder
            </label>
        </div>
    );
}

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
      processFiles(filesArray);
    }
  };

  return (
    <div
      {...getRootProps()}
      className={cn(
        // Base container
        'flex-grow flex flex-col items-center justify-center p-12 rounded-xl transition-all duration-300 ease-out',
        // Border + background states
        'border-2 border-dashed',
        isDragActive
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-muted-foreground/30 hover:bg-muted/10',
        // Focus ring for accessibility
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
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
          message={statusMessage || 'Processing files…'}
          subMessage="Large folders may take a moment"
        />
      )}

      <div
        className={cn(
          'flex flex-col items-center text-center transition-opacity duration-300',
          isLoading && 'opacity-0 pointer-events-none'
        )}
      >
        <UploadCloud
          className={cn(
            'h-16 w-16 mb-6 transition-colors duration-300',
            isDragActive ? 'text-primary' : 'text-muted-foreground'
          )}
        />

        <h2
          className={cn(
            'text-2xl font-semibold mb-2 transition-colors duration-300',
            isDragActive ? 'text-primary' : 'text-foreground'
          )}
        >
          {isDragActive ? 'Drop to start' : 'Drop files or folders'}
        </h2>

        <p className="text-muted-foreground mb-8 max-w-sm transition-colors duration-300">
          {isDragActive
            ? 'Release to begin processing'
            : 'Drag and drop your project files, or choose a folder to analyze'}
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="outline" asChild>
            <label
              htmlFor="folder-upload"
              className="cursor-pointer transition-colors duration-300"
            >
              <Folder className="h-4 w-4 mr-2 transition-colors duration-300" />
              Choose a folder
            </label>
          </Button>
        </div>

        <div className="mt-8 text-xs text-muted-foreground/70 transition-colors duration-300">
          Text files supported • Respects .gitignore • Analyzed locally
        </div>
      </div>
    </div>
  );
}

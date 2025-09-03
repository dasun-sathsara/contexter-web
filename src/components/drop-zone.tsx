'use client';

import { useCallback } from 'react';
import { FileWithPath, useDropzone } from 'react-dropzone';
import { useFileStore } from '@/stores/file-store';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingOverlay } from '@/components/loading-overlay';

export function DropZone() {
  const { processDroppedFiles, isLoading, statusMessage } = useFileStore();

  const onDrop = useCallback(
    (acceptedFiles: FileWithPath[]) => {
      processDroppedFiles(acceptedFiles);
    },
    [processDroppedFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
  });


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

        <div className="mt-8 text-xs text-muted-foreground/70 transition-colors duration-300">
          Text files supported • Respects .gitignore • Analyzed locally
        </div>
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileWithPath, useDropzone } from 'react-dropzone';
import { useFileStore } from '@/stores/file-store';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingOverlay } from '@/components/loading-overlay';
import { Button } from '@/components/ui/button';

export function DropZone() {
  const { processDroppedFiles, isLoading, statusMessage, selectFolder } = useFileStore();

  const onDrop = useCallback(
    (acceptedFiles: FileWithPath[]) => {
      processDroppedFiles(acceptedFiles);
    },
    [processDroppedFiles]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: true,
    multiple: true,
  });

  // Defer feature detection to client to avoid SSR hydration mismatches
  const [folderPickerSupported, setFolderPickerSupported] = useState<boolean | null>(null);
  useEffect(() => {
    setFolderPickerSupported(
      typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
    );
  }, []);

  return (
    <div
      {...getRootProps({
        onKeyDown: (e: React.KeyboardEvent) => {
          if (isLoading) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            open();
          }
        },
      })}
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
      aria-busy={isLoading}
      aria-describedby="dropzone-hint"
      role="button"
      tabIndex={0}
    >
      <input {...getInputProps()} />

      {isLoading && (
        <LoadingOverlay
          message={statusMessage || 'Processing files…'}
          subMessage="Large folders may take a moment"
        />
      )}

      {/* Live region for status updates */}
      <div className="sr-only" aria-live="polite">
        {statusMessage}
      </div>

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
          aria-hidden="true"
        />

        <h2
          className={cn(
            'text-2xl font-semibold mb-2 transition-colors duration-300',
            isDragActive ? 'text-primary' : 'text-foreground'
          )}
        >
          {isDragActive ? 'Drop to start' : 'Drop files or folders'}
        </h2>

        <p id="dropzone-hint" className="text-muted-foreground mb-8 max-w-sm transition-colors duration-300">
          {isDragActive
            ? 'Release to begin processing'
            : 'Drag and drop your project files, or choose a folder to analyze'}
        </p>

        <div className="flex items-center gap-3 mt-4">
          <Button variant="secondary" onClick={() => open()} disabled={isLoading} title="Select one or more files" className="cursor-pointer">
            Select Files
          </Button>
          <Button
            variant="default"
            onClick={() => selectFolder()}
            disabled={isLoading}
            title={
              folderPickerSupported === true
                ? 'Pick a folder using your browser'
                : folderPickerSupported === false
                  ? 'Your browser may not support folder picker'
                  : 'Select a folder'
            }
            className="cursor-pointer"
          >
            Select a Folder
          </Button>
        </div>

        {folderPickerSupported === false && (
          <div className="mt-3 text-xs text-muted-foreground/80">
            Folder picker not supported in this browser. You can still drag a folder here.
          </div>
        )}

        <div className="mt-8 text-xs text-muted-foreground/70 transition-colors duration-300">
          Text files supported • Respects .gitignore • Analyzed locally
        </div>
      </div>
    </div>
  );
}

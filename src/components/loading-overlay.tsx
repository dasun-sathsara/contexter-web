'use client';

import { cn } from '@/lib/utils';

interface LoadingOverlayProps {
  message?: string;
  subMessage?: string;
  className?: string;
}

export function LoadingOverlay({ message = 'Processing files...', subMessage, className }: LoadingOverlayProps) {
  return (
    <div className={cn(
      'absolute inset-0 z-50 flex items-center justify-center',
      'bg-background/80 backdrop-blur-sm',
      'animate-in fade-in-0 duration-300',
      className
    )}>
      <div className="flex flex-col items-center gap-4 p-8">
        {/* Subtle animated dots with custom animation */}
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-primary/60 loading-dot-1" />
          <div className="h-2 w-2 rounded-full bg-primary/60 loading-dot-2" />
          <div className="h-2 w-2 rounded-full bg-primary/60 loading-dot-3" />
        </div>

        {/* Message with fade-in animation */}
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-sm font-medium text-foreground/90 animate-fade-in-up">
            {message}
          </p>
          {subMessage && (
            <p className="text-xs text-muted-foreground animate-fade-in-up [animation-delay:200ms] opacity-0 [animation-fill-mode:forwards]">
              {subMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

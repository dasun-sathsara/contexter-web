'use client';

import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-6 w-6',
        lg: 'h-8 w-8'
    };

    return (
        <div className={cn('relative', sizeClasses[size], className)}>
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-full border-2 border-muted-foreground/20" />
            
            {/* Spinning arc with smooth animation */}
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-smooth-spin" />
            
            {/* Inner dot for visual interest */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-1/3 w-1/3 rounded-full bg-primary/20 animate-subtle-pulse" />
            </div>
        </div>
    );
}

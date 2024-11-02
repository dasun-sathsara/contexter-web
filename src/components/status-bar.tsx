'use client';
import { useFileStore } from '@/stores/file-store';
import { Separator } from './ui/separator';
import { cn } from '@/lib/utils';
import { Zap, CheckCircle, Command, Info } from 'lucide-react';

export function StatusBar() {
    const { vimMode, statusMessage, selectedPaths } = useFileStore();

    const vimModeText = vimMode === 'visual' ? 'VISUAL' : 'NORMAL';
    const selectionText = selectedPaths.size > 0 ? `${selectedPaths.size} selected` : '';

    return (
        <footer className="flex items-center justify-between p-3 border-t bg-muted/30 text-xs">
            <div className="flex items-center gap-4">
                {/* Vim Mode Indicator */}
                <div className="flex items-center gap-2">
                    <Command className="h-3 w-3 text-muted-foreground" />
                    <span
                        className={cn(
                            'font-bold px-2 py-1 rounded text-xs uppercase tracking-wide',
                            vimMode === 'visual'
                                ? 'bg-red-500 text-white shadow-sm'
                                : 'bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20'
                        )}
                    >
                        {vimModeText}
                    </span>
                </div>

                <Separator orientation="vertical" className="h-4" />

                {/* Status Message */}
                <div className="flex items-center gap-2">
                    <Info className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{statusMessage}</span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* Selection Count */}
                {selectionText && (
                    <>
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-3 w-3 text-blue-500" />
                            <span className="font-medium text-blue-600 dark:text-blue-400">
                                {selectionText}
                            </span>
                        </div>
                        <Separator orientation="vertical" className="h-4" />
                    </>
                )}

                {/* Vim Keybindings Help */}
                <div className="flex items-center gap-2 text-muted-foreground/70">
                    <Zap className="h-3 w-3" />
                    <span className="hidden sm:inline">
                        Navigation: <kbd className="px-1 py-0.5 text-xs bg-muted rounded font-mono">j/k</kbd>{' '}
                        <kbd className="px-1 py-0.5 text-xs bg-muted rounded font-mono">h/l</kbd>
                    </span>
                    <span className="hidden md:inline">
                        • Select: <kbd className="px-1 py-0.5 text-xs bg-muted rounded font-mono">v</kbd>{' '}
                        <kbd className="px-1 py-0.5 text-xs bg-muted rounded font-mono">V</kbd>
                    </span>
                    <span className="hidden lg:inline">
                        • Copy: <kbd className="px-1 py-0.5 text-xs bg-muted rounded font-mono">y</kbd>
                    </span>
                </div>
            </div>
        </footer>
    );
}

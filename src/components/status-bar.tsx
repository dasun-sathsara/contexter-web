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
        <footer className="flex items-center justify-between p-4 border-t bg-muted/20 text-xs transition-colors duration-300">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <Command className="h-3 w-3 text-muted-foreground transition-colors duration-300" />
                    <span
                        className={cn(
                            'font-medium px-2 py-0.5 rounded text-xs uppercase tracking-wide transition-colors duration-300',
                            vimMode === 'visual'
                                ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                                : 'bg-green-500/10 text-green-600 dark:text-green-400'
                        )}
                    >
                        {vimModeText}
                    </span>
                </div>

                <Separator orientation="vertical" className="h-3" />

                <div className="flex items-center gap-2">
                    <Info className="h-3 w-3 text-muted-foreground transition-colors duration-300" />
                    <span className="text-muted-foreground transition-colors duration-300">{statusMessage}</span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                {selectionText && (
                    <>
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-3 w-3 text-blue-500 transition-colors duration-300" />
                            <span className="text-blue-600 dark:text-blue-400 px-2 py-0.5 bg-blue-500/10 rounded font-medium transition-colors duration-300">
                                {selectionText}
                            </span>
                        </div>
                        <Separator orientation="vertical" className="h-3" />
                    </>
                )}

                <div className="flex items-center gap-3 text-muted-foreground/70 transition-colors duration-300">
                    <Zap className="h-3 w-3 transition-colors duration-300" />
                    <div className="flex items-center gap-2">
                        <span className="hidden sm:inline text-xs transition-colors duration-300">Navigate:</span>
                        <div className="flex gap-1">
                            <kbd className="px-1.5 py-0.5 text-xs bg-muted/80 text-muted-foreground border border-border/50 rounded font-mono transition-colors duration-300">j</kbd>
                            <kbd className="px-1.5 py-0.5 text-xs bg-muted/80 text-muted-foreground border border-border/50 rounded font-mono transition-colors duration-300">k</kbd>
                            <kbd className="px-1.5 py-0.5 text-xs bg-muted/80 text-muted-foreground border border-border/50 rounded font-mono transition-colors duration-300">h</kbd>
                            <kbd className="px-1.5 py-0.5 text-xs bg-muted/80 text-muted-foreground border border-border/50 rounded font-mono transition-colors duration-300">l</kbd>
                        </div>
                    </div>
                    <div className="hidden md:flex items-center gap-2">
                        <span className="text-xs transition-colors duration-300">Select:</span>
                        <div className="flex gap-1">
                            <kbd className="px-1.5 py-0.5 text-xs bg-muted/80 text-muted-foreground border border-border/50 rounded font-mono transition-colors duration-300">v</kbd>
                            <kbd className="px-1.5 py-0.5 text-xs bg-muted/80 text-muted-foreground border border-border/50 rounded font-mono transition-colors duration-300">V</kbd>
                        </div>
                    </div>
                    <div className="hidden lg:flex items-center gap-2">
                        <span className="text-xs transition-colors duration-300">Copy:</span>
                        <kbd className="px-1.5 py-0.5 text-xs bg-muted/80 text-muted-foreground border border-border/50 rounded font-mono transition-colors duration-300">y</kbd>
                    </div>
                </div>
            </div>
        </footer>
    );
}

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
        <footer className="flex items-center justify-between p-3 border-t bg-gradient-to-r from-muted/20 via-muted/30 to-muted/20 backdrop-blur-sm text-xs">
            <div className="flex items-center gap-4">
                {/* Enhanced Vim Mode Indicator */}
                <div className="flex items-center gap-2 group">
                    <Command className="h-3 w-3 text-muted-foreground transition-transform group-hover:scale-110" />
                    <span
                        className={cn(
                            'font-bold px-2.5 py-1 rounded-md text-xs uppercase tracking-wide transition-all duration-200',
                            'border shadow-sm',
                            vimMode === 'visual'
                                ? 'bg-gradient-to-r from-red-500 to-red-600 text-white border-red-400 shadow-red-500/25'
                                : 'bg-gradient-to-r from-green-500/10 to-green-500/20 text-green-700 dark:text-green-400 border-green-500/25 shadow-green-500/10'
                        )}
                    >
                        {vimModeText}
                    </span>
                </div>

                <Separator orientation="vertical" className="h-4 bg-border/50" />

                {/* Enhanced Status Message */}
                <div className="flex items-center gap-2">
                    <Info className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground font-medium">{statusMessage}</span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* Enhanced Selection Count */}
                {selectionText && (
                    <>
                        <div className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-200">
                            <CheckCircle className="h-3 w-3 text-blue-500" />
                            <span className="font-semibold text-blue-600 dark:text-blue-400 px-2 py-1 bg-blue-500/10 rounded-md border border-blue-500/20">
                                {selectionText}
                            </span>
                        </div>
                        <Separator orientation="vertical" className="h-4 bg-border/50" />
                    </>
                )}

                {/* Enhanced Vim Keybindings Help */}
                <div className="flex items-center gap-3 text-muted-foreground/70">
                    <Zap className="h-3 w-3" />
                    <div className="flex items-center gap-2">
                        <span className="hidden sm:inline text-xs">Navigation:</span>
                        <div className="flex gap-1">
                            <kbd className="px-1.5 py-0.5 text-xs bg-muted/70 rounded font-mono border border-muted-foreground/20 shadow-sm">j</kbd>
                            <kbd className="px-1.5 py-0.5 text-xs bg-muted/70 rounded font-mono border border-muted-foreground/20 shadow-sm">k</kbd>
                            <kbd className="px-1.5 py-0.5 text-xs bg-muted/70 rounded font-mono border border-muted-foreground/20 shadow-sm">h</kbd>
                            <kbd className="px-1.5 py-0.5 text-xs bg-muted/70 rounded font-mono border border-muted-foreground/20 shadow-sm">l</kbd>
                        </div>
                    </div>
                    <div className="hidden md:flex items-center gap-2">
                        <span className="text-xs">Select:</span>
                        <div className="flex gap-1">
                            <kbd className="px-1.5 py-0.5 text-xs bg-muted/70 rounded font-mono border border-muted-foreground/20 shadow-sm">v</kbd>
                            <kbd className="px-1.5 py-0.5 text-xs bg-muted/70 rounded font-mono border border-muted-foreground/20 shadow-sm">V</kbd>
                        </div>
                    </div>
                    <div className="hidden lg:flex items-center gap-2">
                        <span className="text-xs">Copy:</span>
                        <kbd className="px-1.5 py-0.5 text-xs bg-muted/70 rounded font-mono border border-muted-foreground/20 shadow-sm">y</kbd>
                    </div>
                </div>
            </div>
        </footer>
    );
}

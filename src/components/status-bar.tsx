'use client';
import { useFileStore } from '@/stores/file-store';
import { Separator } from './ui/separator';
import { cn } from '@/lib/utils';
import { Zap, CheckCircle, Command, Info, ArrowUpDown } from 'lucide-react';

export function StatusBar() {
    const { vimMode: keybindingMode, statusMessage, selectedPaths, settings, sortByTokens } = useFileStore();

    const vimModeText = keybindingMode === 'visual' ? 'VISUAL' : 'NORMAL';
    const selectionText = selectedPaths.size > 0 ? `${selectedPaths.size} selected` : '';
    const sortLabel = sortByTokens ? 'Tokens' : 'Name';
    const sortShortcutKeys = settings.keybindingMode === 'vim' ? ['g', 't'] : ['Ctrl', 'X'];
    const baseKbdClass = 'rounded-md border border-border/60 bg-background/80 px-2 py-1.5 text-[11.5px] font-semibold text-muted-foreground shadow-sm backdrop-blur leading-none';

    const renderShortcut = (keys: string[], variant: 'mono' | 'sans' = 'mono') => (
        <div className="flex items-center gap-1">
            {keys.map(key => (
                <kbd
                    key={key}
                    className={cn(baseKbdClass, variant === 'mono' ? 'font-mono' : 'font-sans')}
                >
                    {key}
                </kbd>
            ))}
        </div>
    );

    return (
        <footer className="border-t bg-muted/20 text-xs transition-colors duration-300">
            <div className="flex w-full items-center justify-between gap-6 overflow-x-auto whitespace-nowrap px-4 py-3 text-muted-foreground">
                <div className="flex flex-shrink-0 items-center gap-4">
                    {settings.keybindingMode === 'vim' && (
                        <div className="flex items-center gap-2">
                            <Command className="h-3 w-3" />
                            <span
                                className={cn(
                                    'rounded px-2 py-0.5 text-xs font-medium uppercase tracking-wide transition-colors duration-300',
                                    keybindingMode === 'visual'
                                        ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                                        : 'bg-green-500/10 text-green-600 dark:text-green-400'
                                )}
                            >
                                {vimModeText}
                            </span>
                        </div>
                    )}

                    <div className="flex items-center gap-2 rounded-full  px-3 py-1.5 text-foreground">
                        <Info className="h-3.5 w-3.5 text-primary" />
                        <span className="font-medium">{statusMessage}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <ArrowUpDown className="h-3.5 w-3.5 text-primary" />
                        <span className="font-medium">Sort: {sortLabel}</span>
                        <Separator orientation="vertical" className="h-4" />
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                            Toggle
                            {renderShortcut(sortShortcutKeys)}
                        </div>
                    </div>
                </div>

                <div className="flex flex-none items-center gap-4">
                    {selectionText && (
                        <div className="flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1.5 text-blue-600 shadow-sm ring-1 ring-blue-500/40 transition-colors duration-300 dark:text-blue-400">
                            <CheckCircle className="h-3 w-3" />
                            <span className="text-xs font-medium">{selectionText}</span>
                        </div>
                    )}

                    <div className="flex items-center gap-3 text-muted-foreground/80">
                        <Zap className="h-3 w-3" />
                        {settings.keybindingMode === 'vim' ? (
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="hidden sm:inline text-xs">Navigate:</span>
                                    {renderShortcut(['j', 'k', 'h', 'l'])}
                                </div>
                                <div className="hidden md:flex items-center gap-2">
                                    <span className="text-xs">Select:</span>
                                    {renderShortcut(['v', 'V'])}
                                </div>
                                <div className="hidden lg:flex items-center gap-2">
                                    <span className="text-xs">Copy:</span>
                                    {renderShortcut(['y'])}
                                </div>
                                <div className="hidden lg:flex items-center gap-2">
                                    <span className="text-xs">Delete:</span>
                                    {renderShortcut(['d'])}
                                </div>
                                <div className="hidden lg:flex items-center gap-2">
                                    <span className="text-xs">Save:</span>
                                    {renderShortcut(['s'])}
                                </div>
                                <div className="hidden xl:flex items-center gap-2">
                                    <span className="text-xs">Open:</span>
                                    {renderShortcut(['o'])}
                                </div>
                                <div className="hidden xl:flex items-center gap-2">
                                    <span className="text-xs">Go to:</span>
                                    {renderShortcut(['g', 'G'])}
                                </div>
                                <div className="hidden 2xl:flex items-center gap-2">
                                    <span className="text-xs">Toggle:</span>
                                    {renderShortcut(['Space'])}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="hidden sm:inline text-xs">Navigate:</span>
                                    {renderShortcut(['↑', '↓', '←', '→'], 'sans')}
                                </div>
                                <div className="hidden md:flex items-center gap-2">
                                    <span className="text-xs">Open:</span>
                                    {renderShortcut(['Enter'], 'sans')}
                                </div>
                                <div className="hidden lg:flex items-center gap-2">
                                    <span className="text-xs">Preview:</span>
                                    {renderShortcut(['Ctrl+Enter'], 'sans')}
                                </div>
                                <div className="hidden lg:flex items-center gap-2">
                                    <span className="text-xs">Select:</span>
                                    {renderShortcut(['Space', 'Shift+↑/↓'], 'sans')}
                                </div>
                                <div className="hidden xl:flex items-center gap-2">
                                    <span className="text-xs">Copy / Select All:</span>
                                    {renderShortcut(['Ctrl+C', 'Ctrl+A'], 'sans')}
                                </div>
                                <div className="hidden xl:flex items-center gap-2">
                                    <span className="text-xs">Delete:</span>
                                    {renderShortcut(['Del'], 'sans')}
                                </div>
                                <div className="hidden xl:flex items-center gap-2">
                                    <span className="text-xs">Save:</span>
                                    {renderShortcut(['Ctrl+S'], 'sans')}
                                </div>
                                <div className="hidden 2xl:flex items-center gap-2">
                                    <span className="text-xs">Jump:</span>
                                    {renderShortcut(['Home', 'End'], 'sans')}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </footer>
    );
}

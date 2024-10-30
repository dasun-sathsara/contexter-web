'use client';
import { useFileStore } from '@/stores/file-store';
import { Separator } from './ui/separator';
import { cn } from '@/lib/utils';

export function StatusBar() {
    const { vimMode, statusMessage, selectedPaths } = useFileStore();

    const vimModeText = vimMode === 'visual' ? '-- VISUAL --' : '-- NORMAL --';
    const selectionText = selectedPaths.size > 0 ? `${selectedPaths.size} selected` : '';

    return (
        <footer className="flex items-center justify-between p-2 border-t text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
                <span
                    className={cn(
                        'font-bold px-2 py-0.5 rounded-sm text-sm',
                        vimMode === 'visual' ? 'bg-red-500 text-white' : ''
                    )}
                >
                    {vimModeText}
                </span>
                <Separator orientation="vertical" className="h-4" />
                <span>{statusMessage}</span>
            </div>
            <div className="flex items-center gap-4">
                <span>{selectionText}</span>
                <Separator orientation="vertical" className="h-4" />
                <span className="text-xs">Vim: j/k, h/l, v, V, y, d, C, g/G, Esc</span>
            </div>
        </footer>
    );
}

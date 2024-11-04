import { SettingsSheet } from './settings-sheet';
import { ThemeToggle } from './theme-toggle';
import { Layers, Sparkles } from 'lucide-react';

export function Header() {
    return (
        <header className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
                <div className="relative">
                    <Layers className="h-6 w-6 text-primary" />
                    <Sparkles className="h-2.5 w-2.5 text-primary/60 absolute -top-0.5 -right-0.5" />
                </div>
                <div className="flex flex-col">
                    <h1 className="text-lg font-semibold text-foreground">
                        Contexter
                    </h1>
                    <p className="text-xs text-muted-foreground -mt-0.5">
                        Smart code context generator
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <SettingsSheet />
                <ThemeToggle />
            </div>
        </header>
    );
}

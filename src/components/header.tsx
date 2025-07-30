import { SettingsSheet } from './settings-sheet';
import { ThemeToggle } from './theme-toggle';
import { Layers, Sparkles } from 'lucide-react';

export function Header() {
    return (
        <header className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
                <div className="relative group">
                    <Layers className="h-7 w-7 text-primary transition-transform duration-300 group-hover:scale-110" />
                    <Sparkles className="h-3 w-3 text-primary/60 absolute -top-0.5 -right-0.5 animate-pulse opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <h1 className="text-xl font-bold text-foreground tracking-tight hover:text-primary transition-colors duration-200">
                    Contexter
                </h1>
            </div>
            <div className="flex items-center gap-2">
                <SettingsSheet />
                <ThemeToggle />
            </div>
        </header>
    );
}

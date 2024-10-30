import { SettingsSheet } from './settings-sheet';
import { ThemeToggle } from './theme-toggle';
import { FolderCode, Sparkles } from 'lucide-react';

export function Header() {
    return (
        <header className="flex items-center justify-between p-6 border-b bg-card/50 backdrop-blur-sm">
            <div className="flex items-center gap-3">
                <div className="relative">
                    <FolderCode className="h-7 w-7 text-primary" />
                    <Sparkles className="h-3 w-3 text-primary/60 absolute -top-1 -right-1" />
                </div>
                <div className="flex flex-col">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                        Contexter
                    </h1>
                    <p className="text-xs text-muted-foreground -mt-0.5">
                        Smart code context generator
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <SettingsSheet />
                <ThemeToggle />
            </div>
        </header>
    );
}

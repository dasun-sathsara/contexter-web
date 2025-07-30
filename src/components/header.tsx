import { SettingsSheet } from './settings-sheet';
import { ThemeToggle } from './theme-toggle';
import { Layers, Sparkles } from 'lucide-react';
import { useFileStore } from '@/stores/file-store';

export function Header() {
    const { clearAll } = useFileStore();

    const handleTitleClick = () => {
        clearAll();
    };

    return (
        <header className="flex items-center justify-between p-5 border-b transition-colors duration-300">
            <div className="flex items-center gap-3">
                <div className="relative group">
                    <Layers className="h-8 w-8 text-primary transition-all duration-300 group-hover:scale-110 group-hover:rotate-12" />
                    <Sparkles className="h-3 w-3 text-primary/60 absolute -top-0.5 -right-0.5 animate-pulse opacity-0 group-hover:opacity-100 transition-all duration-300" />
                </div>
                <h1
                    className="text-xl font-bold text-foreground tracking-tight hover:text-primary transition-colors duration-300 cursor-pointer select-none"
                    onClick={handleTitleClick}
                    title="Reset application"
                >
                    Contexter
                </h1>
            </div>
            <div className="flex items-center gap-3">
                <SettingsSheet />
                <ThemeToggle />
            </div>
        </header>
    );
}

import { SettingsSheet } from './settings-sheet';
import { ThemeToggle } from './theme-toggle';
import { FolderCode } from 'lucide-react';

export function Header() {
    return (
        <header className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
                <FolderCode className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">Contexter</h1>
            </div>
            <div className="flex items-center gap-4">
                <SettingsSheet />
                <ThemeToggle />
            </div>
        </header>
    );
}

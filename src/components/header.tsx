import { SettingsSheet } from './settings-sheet';
import { ThemeToggle } from './theme-toggle';
import { Layers } from 'lucide-react';
import { useFileStore } from '@/stores/file-store';

export function Header() {
  const { clearAll } = useFileStore();

  const handleTitleClick = () => {
    clearAll();
  };

  return (
    <header className="flex items-center justify-between p-5 border-b transition-colors duration-300 bg-background/60 backdrop-blur-[2px]">
      <div className="flex items-center gap-3">
        {/* Logo with tasteful hover flash and pointer cursor */}
        <div
          className="group relative cursor-pointer select-none transition-transform duration-200 hover:scale-[1.05]"
          onClick={handleTitleClick}
          title="Reset application"
        >
          <Layers className="h-8 w-8 text-primary transition-colors duration-200 group-hover:text-primary" />
          {/* subtle accent dot */}
          <span className="pointer-events-none absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary/70 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></span>
        </div>
        <h1
          className="text-xl font-bold text-foreground tracking-tight hover:text-primary transition-colors duration-200 cursor-pointer select-none"
          onClick={handleTitleClick}
          title="Reset application"
        >
          Contexter
        </h1>
      </div>
      <div className="flex items-center gap-3">
        {/* Settings button with subtle hover flash and pointer cursor */}
        <div className="group cursor-pointer transition-all duration-200 hover:scale-[1.04]">
          <div className="rounded-md ring-0 ring-primary/0 group-hover:ring-1 group-hover:ring-primary/20 transition-all duration-200">
            <SettingsSheet />
          </div>
        </div>
        {/* Theme toggle with subtle hover flash and pointer cursor */}
        <div className="group cursor-pointer transition-all duration-200 hover:scale-[1.04]">
          <div className="rounded-md ring-0 ring-primary/0 group-hover:ring-1 group-hover:ring-primary/20 transition-all duration-200">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}

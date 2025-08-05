'use client';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from './ui/button';
import { Settings, ToggleLeft, Keyboard } from 'lucide-react';
import { useFileStore } from '@/stores/file-store';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { KeybindingMode } from '@/lib/types';

export function SettingsSheet() {
    const { settings, setSettings } = useFileStore();

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    className="relative group hover:border-primary/50 hover:bg-accent/40 transition-colors"
                >
                    <Settings className="h-4 w-4 transition-transform group-hover:rotate-45 duration-200 text-muted-foreground group-hover:text-foreground" />
                    <span className="sr-only">Open Settings</span>
                </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[500px] p-6">
                <SheetHeader className="pb-3">
                    <SheetTitle className="flex items-center gap-2.5 tracking-tight">
                        <Settings className="h-5 w-5 text-primary" />
                        Settings
                    </SheetTitle>
                    <SheetDescription className="text-sm">
                        Customize how Contexter processes and displays your files.
                    </SheetDescription>
                </SheetHeader>

                <div className="space-y-5 py-2">
                    {/* Display Options */}
                    <div className="rounded-lg border bg-card p-4 shadow-sm">
                        <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3 flex items-center gap-2">
                            <ToggleLeft className="h-4 w-4 text-primary" />
                            Display Options
                        </h3>

                        <div className="space-y-3 pl-1">
                            <div className="flex items-start gap-3">
                                <Checkbox
                                    id="show-tokens"
                                    checked={settings.showTokenCount}
                                    onCheckedChange={(checked) => setSettings({ showTokenCount: !!checked })}
                                />
                                <div className="grid gap-1 leading-tight">
                                    <Label htmlFor="show-tokens" className="text-sm font-medium">
                                        Show token counts
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Display token count for each file and folder.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <Checkbox
                                    id="hide-empty"
                                    checked={settings.hideEmptyFolders}
                                    onCheckedChange={(checked) => setSettings({ hideEmptyFolders: !!checked })}
                                />
                                <div className="grid gap-1 leading-tight">
                                    <Label htmlFor="hide-empty" className="text-sm font-medium">
                                        Hide empty folders
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Hide folders that contain no files.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-border" />

                    {/* Keybinding Options */}
                    <div className="rounded-lg border bg-card p-4 shadow-sm">
                        <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3 flex items-center gap-2">
                            <Keyboard className="h-4 w-4 text-primary" />
                            Keybinding Mode
                        </h3>
                        <RadioGroup
                            value={settings.keybindingMode}
                            onValueChange={(value) => setSettings({ keybindingMode: value as KeybindingMode })}
                            className="space-y-2"
                        >
                            <label htmlFor="keybind-standard" className="flex items-start gap-3 cursor-pointer">
                                <RadioGroupItem value="standard" id="keybind-standard" />
                                <div className="grid gap-1 leading-tight">
                                    <span className="text-sm font-medium">Standard</span>
                                    <p className="text-xs text-muted-foreground">
                                        Familiar navigation with Arrow keys, Space, and Enter.
                                    </p>
                                </div>
                            </label>

                            <label htmlFor="keybind-vim" className="flex items-start gap-3 cursor-pointer">
                                <RadioGroupItem value="vim" id="keybind-vim" />
                                <div className="grid gap-1 leading-tight">
                                    <span className="text-sm font-medium">VIM</span>
                                    <p className="text-xs text-muted-foreground">
                                        Modal navigation with h, j, k, l, y, d.
                                    </p>
                                </div>
                            </label>
                        </RadioGroup>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

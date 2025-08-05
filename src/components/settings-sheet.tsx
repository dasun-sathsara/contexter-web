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
                <Button variant="outline" size="icon" className="relative group">
                    <Settings className="h-4 w-4 transition-transform group-hover:rotate-45 duration-200" />
                    <span className="sr-only">Open Settings</span>
                </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[480px] p-6">
                <SheetHeader className="pb-4">
                    <SheetTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5 text-primary" />
                        Settings
                    </SheetTitle>
                    <SheetDescription>
                        Customize how Contexter processes and displays your files.
                    </SheetDescription>
                </SheetHeader>

                <div className="space-y-6 py-4">
                    {/* Display Options */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <ToggleLeft className="h-4 w-4 text-primary" />
                            Display Options
                        </h3>

                        <div className="space-y-3 pl-6">
                            <div className="flex items-center space-x-3">
                                <Checkbox
                                    id="show-tokens"
                                    checked={settings.showTokenCount}
                                    onCheckedChange={(checked) => setSettings({ showTokenCount: !!checked })}
                                />
                                <div className="grid gap-1.5 leading-none">
                                    <Label htmlFor="show-tokens" className="text-sm font-medium">
                                        Show token counts
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Display token count for each file and folder
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-3">
                                <Checkbox
                                    id="hide-empty"
                                    checked={settings.hideEmptyFolders}
                                    onCheckedChange={(checked) => setSettings({ hideEmptyFolders: !!checked })}
                                />
                                <div className="grid gap-1.5 leading-none">
                                    <Label htmlFor="hide-empty" className="text-sm font-medium">
                                        Hide empty folders
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Hide folders that contain no files
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Keybinding Options */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <Keyboard className="h-4 w-4 text-primary" />
                            Keybinding Mode
                        </h3>
                        <RadioGroup
                            value={settings.keybindingMode}
                            onValueChange={(value) => setSettings({ keybindingMode: value as KeybindingMode })}
                            className="space-y-1 pl-6"
                        >
                            <div className="flex items-center space-x-3">
                                <RadioGroupItem value="standard" id="keybind-standard" />
                                <div className="grid gap-1.5 leading-none">
                                    <Label htmlFor="keybind-standard" className="font-medium">
                                        Standard
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Familiar navigation with Arrow keys, Space, and Enter.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-3">
                                <RadioGroupItem value="vim" id="keybind-vim" />
                                <div className="grid gap-1.5 leading-none">
                                    <Label htmlFor="keybind-vim" className="font-medium">
                                        VIM
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Modal navigation with h, j, k, l, y, d.
                                    </p>
                                </div>
                            </div>
                        </RadioGroup>
                    </div>

                </div>
            </SheetContent>
        </Sheet>
    );
}

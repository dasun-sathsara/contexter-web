'use client';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from './ui/button';
import { Settings, Eye, Filter, Trash2 } from 'lucide-react';
import { useFileStore } from '@/stores/file-store';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Separator } from './ui/separator';

export function SettingsSheet() {
    const { settings, setSettings, clearAll } = useFileStore();

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
                            <Eye className="h-4 w-4 text-primary" />
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

                    <Separator />

                    {/* File Filtering */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <Filter className="h-4 w-4 text-primary" />
                            File Filtering
                        </h3>

                        <div className="pl-6">
                            <div className="flex items-center space-x-3">
                                <Checkbox
                                    id="text-only"
                                    checked={settings.textOnly}
                                    onCheckedChange={(checked) => setSettings({ textOnly: !!checked })}
                                />
                                <div className="grid gap-1.5 leading-none">
                                    <Label htmlFor="text-only" className="text-sm font-medium">
                                        Text files only
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Include only text-based files
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Reset Section */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-destructive flex items-center gap-2">
                            <Trash2 className="h-4 w-4" />
                            Reset Data
                        </h3>

                        <div className="pl-6">
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                    if (confirm('Are you sure you want to clear all files? This cannot be undone.')) {
                                        clearAll();
                                    }
                                }}
                                className="w-full"
                            >
                                <Trash2 className="h-3 w-3 mr-2" />
                                Clear All Files
                            </Button>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

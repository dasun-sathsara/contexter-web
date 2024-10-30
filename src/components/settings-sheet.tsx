'use client';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from './ui/button';
import { Settings, Eye, Filter, FileText, Trash2, Hash, FolderX } from 'lucide-react';
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
                    <Settings className="h-4 w-4 transition-transform group-hover:rotate-90 duration-300" />
                    <span className="sr-only">Open Settings</span>
                </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px]">
                <SheetHeader className="pb-6">
                    <SheetTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5 text-primary" />
                        Settings & Preferences
                    </SheetTitle>
                    <SheetDescription>
                        Customize how Contexter processes and displays your files to optimize your workflow.
                    </SheetDescription>
                </SheetHeader>

                <div className="flex flex-col gap-8 py-4">
                    {/* Display Options */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2">
                            <Eye className="h-4 w-4 text-primary" />
                            <h3 className="text-sm font-semibold text-foreground">Display Options</h3>
                        </div>

                        <div className="space-y-4 pl-6">
                            <div className="flex items-start space-x-3">
                                <Checkbox
                                    id="show-tokens"
                                    checked={settings.showTokenCount}
                                    onCheckedChange={(checked) => setSettings({ showTokenCount: !!checked })}
                                    className="mt-1"
                                />
                                <div className="flex-1 space-y-1">
                                    <Label htmlFor="show-tokens" className="flex items-center gap-2 font-medium">
                                        <Hash className="h-3 w-3" />
                                        Show Token Counts
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Display the estimated token count for each file and folder to help with context management.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-3">
                                <Checkbox
                                    id="hide-empty"
                                    checked={settings.hideEmptyFolders}
                                    onCheckedChange={(checked) => setSettings({ hideEmptyFolders: !!checked })}
                                    className="mt-1"
                                />
                                <div className="flex-1 space-y-1">
                                    <Label htmlFor="hide-empty" className="flex items-center gap-2 font-medium">
                                        <FolderX className="h-3 w-3" />
                                        Hide Empty Folders
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Hide folders that don't contain any processable files to reduce clutter.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* File Filtering */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2">
                            <Filter className="h-4 w-4 text-primary" />
                            <h3 className="text-sm font-semibold text-foreground">File Filtering</h3>
                        </div>

                        <div className="space-y-4 pl-6">
                            <div className="flex items-start space-x-3">
                                <Checkbox
                                    id="text-only"
                                    checked={settings.textOnly}
                                    onCheckedChange={(checked) => setSettings({ textOnly: !!checked })}
                                    className="mt-1"
                                />
                                <div className="flex-1 space-y-1">
                                    <Label htmlFor="text-only" className="flex items-center gap-2 font-medium">
                                        <FileText className="h-3 w-3" />
                                        Process Text-Based Files Only
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Filter out binary files (images, videos, executables) by extension.
                                        Disable to attempt processing all files, which may include unreadable content.
                                    </p>
                                    <div className="text-xs text-muted-foreground/80 bg-muted/30 p-2 rounded-md mt-2">
                                        <strong>Excluded extensions:</strong> .jpg, .png, .gif, .mp4, .pdf, .zip, .exe, and similar binary formats
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Danger Zone */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2">
                            <Trash2 className="h-4 w-4 text-destructive" />
                            <h3 className="text-sm font-semibold text-destructive">Reset & Clear Data</h3>
                        </div>

                        <div className="space-y-4 pl-6">
                            <div className="p-4 border border-destructive/20 bg-destructive/5 rounded-lg">
                                <div className="flex items-start gap-3">
                                    <Trash2 className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                                    <div className="flex-1">
                                        <h4 className="text-sm font-medium text-destructive mb-2">Clear All Files</h4>
                                        <p className="text-xs text-muted-foreground mb-3">
                                            Remove all loaded files and reset the application to its initial state.
                                            This action cannot be undone.
                                        </p>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => {
                                                if (confirm('Are you sure you want to clear all loaded files? This action cannot be undone.')) {
                                                    clearAll();
                                                }
                                            }}
                                            className="h-8"
                                        >
                                            <Trash2 className="h-3 w-3 mr-1" />
                                            Clear All Files
                                        </Button>
                                        <p className="text-xs text-muted-foreground/80 mt-2">
                                            Quick shortcut: <kbd className="px-1 py-0.5 text-xs bg-muted rounded font-mono">Shift+C</kbd>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

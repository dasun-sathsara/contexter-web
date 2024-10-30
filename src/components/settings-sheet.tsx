'use client';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from './ui/button';
import { Settings } from 'lucide-react';
import { useFileStore } from '@/stores/file-store';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Separator } from './ui/separator';

export function SettingsSheet() {
    const { settings, setSettings, clearAll } = useFileStore();

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                    <Settings className="h-4 w-4" />
                </Button>
            </SheetTrigger>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Settings</SheetTitle>
                    <SheetDescription>Customize how Contexter processes and displays your files.</SheetDescription>
                </SheetHeader>
                <div className="grid gap-4 py-4">
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="text-only"
                            checked={settings.textOnly}
                            onCheckedChange={(checked) => setSettings({ textOnly: !!checked })}
                        />
                        <Label htmlFor="text-only">Show Text Files Only</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="hide-empty"
                            checked={settings.hideEmptyFolders}
                            onCheckedChange={(checked) => setSettings({ hideEmptyFolders: !!checked })}
                        />
                        <Label htmlFor="hide-empty">Hide Empty Folders</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="show-tokens"
                            checked={settings.showTokenCount}
                            onCheckedChange={(checked) => setSettings({ showTokenCount: !!checked })}
                        />
                        <Label htmlFor="show-tokens">Show Token Counts</Label>
                    </div>
                </div>
                <Separator className="my-4" />
                <div className="flex flex-col gap-4">
                    <h3 className="font-semibold">Actions</h3>
                    <Button
                        variant="destructive"
                        onClick={() => {
                            if (confirm('Are you sure you want to clear all files? This cannot be undone.')) {
                                clearAll();
                            }
                        }}
                    >
                        Clear All Files (C)
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}

'use client';

import { Suspense, lazy, useEffect, useState, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useFileStore } from '@/stores/file-store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { File as FileIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const SyntaxHighlighter = lazy(() => import('react-syntax-highlighter'));

const getLanguage = (path: string | null): string => {
    if (!path) return 'text';
    const filename = path.split('/').pop()?.toLowerCase() || '';
    const extension = filename.split('.').pop() || '';

    if (filename === 'dockerfile' || filename.endsWith('dockerfile')) return 'dockerfile';
    if (filename === 'makefile') return 'makefile';

    // This mapping is based on what react-syntax-highlighter and prismjs support
    switch (extension) {
        case 'js':
        case 'mjs':
        case 'cjs':
            return 'javascript';
        case 'ts':
        case 'mts':
        case 'cts':
            return 'typescript';
        case 'tsx':
            return 'tsx';
        case 'jsx':
            return 'jsx';
        case 'py':
            return 'python';
        case 'rs':
            return 'rust';
        case 'go':
            return 'go';
        case 'java':
            return 'java';
        case 'c':
        case 'h':
            return 'c';
        case 'cpp':
        case 'cxx':
        case 'cc':
        case 'hpp':
        case 'hxx':
            return 'cpp';
        case 'cs':
            return 'csharp';
        case 'php':
            return 'php';
        case 'rb':
            return 'ruby';
        case 'swift':
            return 'swift';
        case 'kt':
        case 'kts':
            return 'kotlin';
        case 'html':
        case 'htm':
            return 'html';
        case 'css':
            return 'css';
        case 'scss':
        case 'sass':
            return 'scss';
        case 'less':
            return 'less';
        case 'vue':
            return 'markup'; // best guess for vue with prism
        case 'svelte':
            return 'svelte';
        case 'astro':
            return 'astro';
        case 'json':
            return 'json';
        case 'xml':
            return 'xml';
        case 'yaml':
        case 'yml':
            return 'yaml';
        case 'toml':
            return 'toml';
        case 'sh':
        case 'bash':
        case 'zsh':
            return 'bash';
        case 'sql':
            return 'sql';
        case 'md':
        case 'mdx':
            return 'markdown';
        default:
            return 'text';
    }
};

const LoadingState = () => (
    <div className="flex items-center justify-center h-full p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
);

export function FilePreviewModal() {
    const { previewedFilePath, fileMap, rootFiles, closePreview } = useFileStore();
    const { theme } = useTheme();
    const [style, setStyle] = useState({});

    useEffect(() => {
        if (theme === 'dark') {
            import('react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus').then((module) =>
                setStyle(module.default)
            );
        } else {
            import('react-syntax-highlighter/dist/esm/styles/prism/vs').then((module) => setStyle(module.default));
        }
    }, [theme]);

    const isOpen = !!previewedFilePath;
    const fileNode = previewedFilePath ? fileMap.get(previewedFilePath) : null;
    const content = previewedFilePath ? rootFiles.get(previewedFilePath) ?? '' : '';
    const language = getLanguage(fileNode?.path ?? null);

    const handleCopy = useCallback(() => {
        if (!content) return;
        navigator.clipboard
            .writeText(content)
            .then(() => {
                toast.success('File content copied to clipboard! (Press Y to copy again)');
            })
            .catch((err) => {
                console.error('Failed to copy text: ', err);
                toast.error('Could not copy to clipboard.');
            });
    }, [content]);

    // Keyboard handling for copy functionality
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!isOpen) return;

            if (event.key.toLowerCase() === 'y' && !event.ctrlKey && !event.metaKey && !event.altKey) {
                event.preventDefault();
                handleCopy();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, handleCopy]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && closePreview()}>
            <DialogContent className="max-w-[95vw] max-h-[90vh] w-[95vw] h-[90vh] flex flex-col p-0 gap-0 sm:max-w-[95vw]">
                {fileNode && (
                    <>
                        <DialogHeader className="px-6 py-4 border-b flex-shrink-0 space-y-0">
                            <div className="flex items-center gap-3">
                                <FileIcon className="h-5 w-5 text-primary flex-shrink-0" />
                                <div className="flex flex-col min-w-0">
                                    <DialogTitle className="truncate text-left text-lg font-semibold">
                                        {fileNode.name}
                                    </DialogTitle>
                                    <DialogDescription className="truncate text-xs text-left mt-1 text-muted-foreground">
                                        {fileNode.path}
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                        <div className="flex-grow overflow-hidden">
                            <ScrollArea className="h-full">
                                <Suspense fallback={<LoadingState />}>
                                    <SyntaxHighlighter
                                        language={language}
                                        style={style}
                                        customStyle={{
                                            margin: 0,
                                            padding: '1.5rem',
                                            backgroundColor: 'transparent',
                                            fontSize: '0.875rem',
                                            lineHeight: '1.6',
                                            fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", "Monaco", "Courier New", monospace',
                                        }}
                                        codeTagProps={{
                                            className: 'font-mono',
                                            style: { fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", "Monaco", "Courier New", monospace' }
                                        }}
                                        showLineNumbers
                                        wrapLines
                                    >
                                        {content}
                                    </SyntaxHighlighter>
                                </Suspense>
                            </ScrollArea>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

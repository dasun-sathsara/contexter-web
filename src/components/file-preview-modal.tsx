'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useFileStore } from '@/stores/file-store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { File as FileIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Use PrismLight for performant syntax highlighting with registered languages
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
// Register only the required languages
import jsLang from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import tsLang from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import jsxLang from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import tsxLang from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import pythonLang from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import rustLang from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import goLang from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import bashLang from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import javaLang from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import cLang from 'react-syntax-highlighter/dist/esm/languages/prism/c';
import cppLang from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import csharpLang from 'react-syntax-highlighter/dist/esm/languages/prism/csharp';
import phpLang from 'react-syntax-highlighter/dist/esm/languages/prism/php';
import rubyLang from 'react-syntax-highlighter/dist/esm/languages/prism/ruby';
import swiftLang from 'react-syntax-highlighter/dist/esm/languages/prism/swift';
import kotlinLang from 'react-syntax-highlighter/dist/esm/languages/prism/kotlin';
import htmlLang from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import cssLang from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import scssLang from 'react-syntax-highlighter/dist/esm/languages/prism/scss';
import lessLang from 'react-syntax-highlighter/dist/esm/languages/prism/less';
import jsonLang from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import yamlLang from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import markdownLang from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import sqlLang from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import tomlLang from 'react-syntax-highlighter/dist/esm/languages/prism/toml';

// Register languages for PrismLight
SyntaxHighlighter.registerLanguage('javascript', jsLang);
SyntaxHighlighter.registerLanguage('typescript', tsLang);
SyntaxHighlighter.registerLanguage('jsx', jsxLang);
SyntaxHighlighter.registerLanguage('tsx', tsxLang);
SyntaxHighlighter.registerLanguage('python', pythonLang);
SyntaxHighlighter.registerLanguage('rust', rustLang);
SyntaxHighlighter.registerLanguage('go', goLang);
SyntaxHighlighter.registerLanguage('bash', bashLang);
SyntaxHighlighter.registerLanguage('java', javaLang);
SyntaxHighlighter.registerLanguage('c', cLang);
SyntaxHighlighter.registerLanguage('cpp', cppLang);
SyntaxHighlighter.registerLanguage('csharp', csharpLang);
SyntaxHighlighter.registerLanguage('php', phpLang);
SyntaxHighlighter.registerLanguage('ruby', rubyLang);
SyntaxHighlighter.registerLanguage('swift', swiftLang);
SyntaxHighlighter.registerLanguage('kotlin', kotlinLang);
SyntaxHighlighter.registerLanguage('markup', htmlLang);
SyntaxHighlighter.registerLanguage('html', htmlLang);
SyntaxHighlighter.registerLanguage('css', cssLang);
SyntaxHighlighter.registerLanguage('scss', scssLang);
SyntaxHighlighter.registerLanguage('less', lessLang);
SyntaxHighlighter.registerLanguage('json', jsonLang);
SyntaxHighlighter.registerLanguage('yaml', yamlLang);
SyntaxHighlighter.registerLanguage('markdown', markdownLang);
SyntaxHighlighter.registerLanguage('sql', sqlLang);
SyntaxHighlighter.registerLanguage('toml', tomlLang);
SyntaxHighlighter.registerLanguage('xml', htmlLang);

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
                                        wrapLongLines
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

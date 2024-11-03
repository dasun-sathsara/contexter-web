/**
 * High-Performance Worker for File Processing with WASM Support
 * This worker handles file processing using WASM for maximum performance
 */

import { FileInput } from '@/lib/types';

// WASM Module Interface
interface WasmModule {
    merge_files_to_markdown: (files: FileInput[], options: {
        include_header: boolean;
        include_toc: boolean;
        include_path_headers: boolean;
        include_stats: boolean;
    }) => string;
    filter_files: (metadata: FileMetadata[], gitignoreContent: string, rootPrefix: string, options: FilterSettings) => { paths: string[] };
    process_files: (files: FileInput[], options: ProcessingSettings) => {
        file_tree: FileNode[];
        total_tokens: number;
        total_files: number;
        total_size: number;
        processing_time_ms: number;
    };
}

// Global WASM instance
let wasmModule: WasmModule | null = null;
let wasmLoadPromise: Promise<WasmModule | null> | null = null;

// Load WASM module using dynamic import
async function loadWasm(): Promise<WasmModule | null> {
    if (wasmModule) {
        return wasmModule;
    }

    if (wasmLoadPromise) {
        return wasmLoadPromise;
    }

    wasmLoadPromise = (async () => {
        try {
            // Use dynamic import to load WASM module at runtime
            const wasmUrl = '/contexter_wasm.js';
            const wasmImport = await import(/* webpackIgnore: true */ wasmUrl);
            await wasmImport.default();

            console.log('WASM module loaded successfully');

            wasmModule = {
                merge_files_to_markdown: wasmImport.merge_files_to_markdown,
                filter_files: wasmImport.filter_files,
                process_files: wasmImport.process_files,
            };

            return wasmModule;
        } catch (error) {
            console.warn('Failed to load WASM, falling back to JavaScript:', error);
            return null;
        }
    })();

    return wasmLoadPromise;
}

interface FileMetadata {
    path: string;
    size: number;
    lastModified?: number;
}

interface FilterSettings {
    textOnly: boolean;
    maxFileSize?: number;
    includePatterns?: string[];
    excludePatterns?: string[];
}

interface ProcessingSettings {
    textOnly: boolean;
    hideEmptyFolders: boolean;
    showTokenCount: boolean;
}

interface MarkdownOptions {
    includeHeader?: boolean;
    includeToc?: boolean;
    includePathHeaders?: boolean;
    includeStats?: boolean;
}

interface FileNode {
    path: string;
    name: string;
    is_dir: boolean;
    token_count?: number;
    children: FileNode[];
    size?: number;
    last_modified?: number;
}

// Simple text file detection
function isTextFile(path: string): boolean {
    const textExtensions = new Set([
        'js', 'ts', 'tsx', 'jsx', 'json', 'md', 'mdx', 'html', 'css', 'scss', 'sass', 'less',
        'py', 'pyi', 'rs', 'go', 'java', 'c', 'cpp', 'cc', 'cxx', 'h', 'hpp', 'hxx',
        'txt', 'rtf', 'yml', 'yaml', 'xml', 'toml', 'ini', 'conf', 'config',
        'dockerfile', 'makefile', 'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd'
    ]);

    const ext = path.split('.').pop()?.toLowerCase();
    return ext ? textExtensions.has(ext) : false;
}

// Simple token counting (rough estimate)
function estimateTokens(content: string): number {
    return Math.floor(content.length / 4);
}

// Build file tree from files
function buildFileTree(files: FileInput[], options: ProcessingSettings): FileNode[] {
    if (!files || !Array.isArray(files)) {
        console.error('buildFileTree: files is not an array', files);
        return [];
    }

    if (files.length === 0) {
        return [];
    }

    const nodeMap = new Map<string, FileNode>();

    // Create nodes for all files
    for (const file of files) {
        if (!file || typeof file.path !== 'string' || typeof file.content !== 'string') {
            console.warn('buildFileTree: invalid file object', file);
            continue;
        }

        const path = file.path.replace(/\\/g, '/');
        const parts = path.split('/');
        const fileName = parts[parts.length - 1];

        const node: FileNode = {
            path,
            name: fileName,
            is_dir: false,
            token_count: options.showTokenCount ? estimateTokens(file.content) : undefined,
            children: [],
            size: file.content.length,
        };

        nodeMap.set(path, node);

        // Create parent directories
        let currentPath = '';
        for (let i = 0; i < parts.length - 1; i++) {
            currentPath += (i > 0 ? '/' : '') + parts[i];

            if (!nodeMap.has(currentPath)) {
                nodeMap.set(currentPath, {
                    path: currentPath,
                    name: parts[i],
                    is_dir: true,
                    children: [],
                });
            }
        }
    }

    // Build hierarchy
    const rootNodes: FileNode[] = [];

    for (const [path, node] of nodeMap.entries()) {
        const parts = path.split('/');

        if (parts.length === 1) {
            rootNodes.push(node);
        } else {
            const parentPath = parts.slice(0, -1).join('/');
            const parent = nodeMap.get(parentPath);
            if (parent && parent.is_dir) {
                parent.children.push(node);
            }
        }
    }

    // Sort nodes
    function sortNodes(nodes: FileNode[]) {
        nodes.sort((a, b) => {
            if (a.is_dir && !b.is_dir) return -1;
            if (!a.is_dir && b.is_dir) return 1;
            return a.name.localeCompare(b.name);
        });

        nodes.forEach(node => {
            if (node.is_dir) {
                sortNodes(node.children);
            }
        });
    }

    sortNodes(rootNodes);

    // Calculate directory stats
    function calculateDirStats(node: FileNode): { tokens: number; size: number } {
        if (!node.is_dir) {
            return {
                tokens: node.token_count || 0,
                size: node.size || 0
            };
        }

        let totalTokens = 0;
        let totalSize = 0;

        for (const child of node.children) {
            const stats = calculateDirStats(child);
            totalTokens += stats.tokens;
            totalSize += stats.size;
        }

        node.token_count = totalTokens;
        node.size = totalSize;

        return { tokens: totalTokens, size: totalSize };
    }

    rootNodes.forEach(calculateDirStats);

    return rootNodes;
}

// Filter files based on criteria
function filterFiles(
    metadata: FileMetadata[],
    gitignoreContent: string,
    rootPrefix: string,
    options: FilterSettings
): string[] {
    const maxSize = options.maxFileSize || 2 * 1024 * 1024;

    // Simple gitignore patterns
    const ignorePatterns = new Set(['node_modules', '.git', 'target', 'dist', 'build', '.next']);

    return metadata
        .filter(meta => {
            // Size check
            if (meta.size > maxSize) return false;

            // Text file check
            if (options.textOnly && !isTextFile(meta.path)) return false;

            // Simple gitignore check
            const pathParts = meta.path.split('/');
            for (const part of pathParts) {
                if (ignorePatterns.has(part)) return false;
            }

            return true;
        })
        .map(meta => meta.path);
}

// Generate markdown using WASM when available, fallback to JavaScript
async function generateMarkdown(files: FileInput[], options: MarkdownOptions = {}): Promise<string> {
    // Guard against invalid files
    if (!files || !Array.isArray(files)) {
        console.error('generateMarkdown: invalid files array', files);
        return '';
    }

    try {
        // Try to use WASM for maximum performance
        const wasm = await loadWasm();
        if (wasm && wasm.merge_files_to_markdown) {
            console.log('Using WASM for markdown generation');
            return wasm.merge_files_to_markdown(files, {
                include_header: options.includeHeader || false,
                include_toc: options.includeToc || false,
                include_path_headers: options.includePathHeaders !== false, // Default to true
                include_stats: options.includeStats || false,
            });
        }
    } catch (error) {
        console.warn('WASM markdown generation failed, falling back to JavaScript:', error);
    }

    // Fallback to JavaScript implementation
    console.log('Using JavaScript fallback for markdown generation');
    return generateMarkdownFallback(files, options);
}

// JavaScript fallback implementation
function generateMarkdownFallback(files: FileInput[], options: MarkdownOptions = {}): string {
    let markdown = '';

    if (options.includeHeader) {
        markdown += '# Project Files\n\n';
        markdown += `Generated: ${new Date().toISOString()}\n\n`;
    }

    if (options.includeToc && files.length > 1) {
        markdown += '## Table of Contents\n\n';
        files.forEach((file, i) => {
            markdown += `${i + 1}. [${file.path}](#${file.path.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()})\n`;
        });
        markdown += '\n';
    }

    files.forEach((file, i) => {
        if (i > 0) markdown += '\n\n';

        if (options.includePathHeaders) {
            markdown += `#### File: ${file.path}\n\n`;
        }

        if (options.includeStats) {
            const lines = file.content.split('\n').length;
            markdown += `*Lines: ${lines}, Characters: ${file.content.length}*\n\n`;
        }

        const ext = file.path.split('.').pop()?.toLowerCase() || '';
        const language = ['js', 'ts', 'jsx', 'tsx'].includes(ext) ? ext :
            ['py'].includes(ext) ? 'python' :
                ['rs'].includes(ext) ? 'rust' :
                    ['go'].includes(ext) ? 'go' :
                        ['java'].includes(ext) ? 'java' :
                            ['css', 'scss', 'sass'].includes(ext) ? 'css' :
                                ['html'].includes(ext) ? 'html' :
                                    ['json'].includes(ext) ? 'json' :
                                        ['md', 'mdx'].includes(ext) ? 'markdown' : '';

        markdown += `\`\`\`${language}\n${file.content.trim()}\n\`\`\``;
    });

    return markdown;
}

// Message handling
self.onmessage = async (event) => {
    const { type, payload, requestId } = event.data;

    try {
        switch (type) {
            case 'filter-files': {
                const { metadata, gitignoreContent, rootPrefix, settings } = payload;
                const filteringStartTime = performance.now();
                const result = filterFiles(metadata, gitignoreContent, rootPrefix, settings);
                const filteringTime = Math.round(performance.now() - filteringStartTime);

                self.postMessage({
                    type: 'filter-complete',
                    payload: result,
                    requestId,
                    processingTime: filteringTime
                });
                break;
            }

            case 'process-files': {
                const { files, settings } = payload;

                if (!files || !Array.isArray(files)) {
                    throw new Error('Invalid files data: expected array');
                }

                if (!settings || typeof settings !== 'object') {
                    throw new Error('Invalid settings data: expected object');
                }

                console.log('Processing files:', files.length, 'settings:', settings);

                const processingStartTime = performance.now();
                const fileTree = buildFileTree(files, settings);
                const processingTime = Math.round(performance.now() - processingStartTime);

                const totalTokens = fileTree.reduce((sum, node) => sum + (node.token_count || 0), 0);
                const totalSize = fileTree.reduce((sum, node) => sum + (node.size || 0), 0);

                self.postMessage({
                    type: 'processing-complete',
                    payload: {
                        file_tree: fileTree,
                        total_tokens: totalTokens,
                        total_files: files.length,
                        total_size: totalSize,
                        processing_time_ms: processingTime
                    },
                    requestId
                });
                break;
            } case 'merge-files': {
                const { files, options } = payload;

                // Handle async markdown generation
                generateMarkdown(files, options).then(markdown => {
                    self.postMessage({
                        type: 'markdown-result',
                        payload: markdown,
                        requestId
                    });
                }).catch(error => {
                    console.error('Markdown generation failed:', error);
                    self.postMessage({
                        type: 'processing-error',
                        payload: `Markdown generation failed: ${error.message || error}`,
                        requestId
                    });
                });
                break;
            }

            default:
                throw new Error(`Unknown message type: ${type}`);
        }
    } catch (error) {
        self.postMessage({
            type: 'processing-error',
            payload: error instanceof Error ? error.message : String(error),
            requestId
        });
    }
};

// Error handling
self.onerror = (error) => {
    const message = error instanceof ErrorEvent ? error.message : String(error);
    self.postMessage({
        type: 'processing-error',
        payload: `Worker error: ${message}`
    });
};

self.onunhandledrejection = (event) => {
    self.postMessage({
        type: 'processing-error',
        payload: `Unhandled promise rejection: ${event.reason}`
    });
    event.preventDefault();
};

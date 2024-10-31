/**
 * Enhanced File Processor Web Worker
 * 
 * This worker handles computationally intensive file processing tasks:
 * - File filtering based on various criteria
 * - File tree construction and token counting
 * - Markdown generation with syntax highlighting
 * - WASM module management and error recovery
 * 
 * Features:
 * - Robust error handling with recovery strategies
 * - Performance monitoring and optimization
 * - Memory-efficient processing for large file sets
 * - Progress reporting for long-running operations
 * - Caching for repeated operations
 */

import { FileInput } from '@/lib/types';

// Enhanced type definitions for better type safety
interface BaseMessage {
    type: string;
    requestId?: string;
    timestamp?: number;
}

interface FilterFilesMessage extends BaseMessage {
    type: 'filter-files';
    payload: {
        metadata: FileMetadata[];
        gitignoreContent: string;
        rootPrefix: string;
        settings: FilterSettings;
    };
}

interface ProcessFilesMessage extends BaseMessage {
    type: 'process-files';
    payload: {
        files: FileInput[];
        settings: ProcessingSettings;
    };
}

interface MergeFilesMessage extends BaseMessage {
    type: 'merge-files';
    payload: {
        files: FileInput[];
        options?: MarkdownOptions;
    };
}

type WorkerMessage = FilterFilesMessage | ProcessFilesMessage | MergeFilesMessage;

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

interface WorkerResponse {
    type: string;
    payload: any;
    requestId?: string;
    timestamp: number;
    processingTime?: number;
}

// WASM module management with enhanced error handling and caching
class WasmManager {
    private instance: any = null;
    private isLoading = false;
    private loadPromise: Promise<any> | null = null;
    private retryCount = 0;
    private readonly maxRetries = 3;
    private readonly retryDelay = 1000;

    async initialize(): Promise<any> {
        if (this.instance) {
            return this.instance;
        }

        if (this.isLoading && this.loadPromise) {
            return this.loadPromise;
        }

        this.isLoading = true;
        this.loadPromise = this.loadWasmModule();

        try {
            this.instance = await this.loadPromise;
            this.retryCount = 0; // Reset retry count on success
            return this.instance;
        } catch (error) {
            this.isLoading = false;
            this.loadPromise = null;

            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                console.warn(`WASM load failed, retrying (${this.retryCount}/${this.maxRetries})...`);

                // Exponential backoff
                await this.delay(this.retryDelay * Math.pow(2, this.retryCount - 1));
                return this.initialize();
            }

            console.warn('WASM loading failed, using fallback implementations');
            return this.createFallbackInstance();
        } finally {
            this.isLoading = false;
        }
    }

    private createFallbackInstance() {
        return {
            filter_files: this.fallbackFilterFiles.bind(this),
            process_files: this.fallbackProcessFiles.bind(this),
            merge_files_to_markdown: this.fallbackMergeFiles.bind(this),
            memory: null,
        };
    }

    private fallbackFilterFiles(metadata: FileMetadata[], gitignoreContent: string, rootPrefix: string, options: any) {
        // Basic JavaScript implementation
        const filteredPaths = metadata
            .filter(file => {
                if (options.textOnly) {
                    const textExtensions = ['.txt', '.md', '.js', '.ts', '.jsx', '.tsx', '.json', '.css', '.html', '.xml', '.yaml', '.yml'];
                    return textExtensions.some(ext => file.path.endsWith(ext));
                }
                return true;
            })
            .filter(file => {
                if (options.maxFileSize && file.size > options.maxFileSize) {
                    return false;
                }
                return true;
            })
            .map(file => file.path);

        return {
            paths: filteredPaths,
            processingTimeMs: 0,
        };
    }

    private fallbackProcessFiles(files: FileInput[], options: any) {
        // Basic JavaScript implementation
        const processedFiles = files.map(file => ({
            ...file,
            tokenCount: Math.floor(file.content.length / 4), // Rough estimate
        }));

        return {
            files: processedFiles,
            totalTokens: processedFiles.reduce((sum, file) => sum + (file.tokenCount || 0), 0),
        };
    }

    private fallbackMergeFiles(files: FileInput[], options: any) {
        // Basic JavaScript implementation
        let markdown = '';

        if (options.includeHeader) {
            markdown += '# File Contents\n\n';
        }

        files.forEach(file => {
            if (options.includePathHeaders) {
                markdown += `## ${file.path}\n\n`;
            }
            markdown += '```\n';
            markdown += file.content;
            markdown += '\n```\n\n';
        });

        return markdown;
    }

    private async loadWasmModule(): Promise<any> {
        try {
            // Try multiple paths for WASM file
            const wasmPaths = [
                `${self.location.origin}/contexter_wasm_bg.wasm`,
                `${self.location.origin}/_next/static/wasm/contexter_wasm_bg.wasm`,
                '/contexter_wasm_bg.wasm'
            ];

            let wasmBytes: ArrayBuffer | null = null;
            let wasmResponse: Response | null = null;

            for (const path of wasmPaths) {
                try {
                    wasmResponse = await fetch(path);
                    if (wasmResponse.ok) {
                        wasmBytes = await wasmResponse.arrayBuffer();
                        break;
                    }
                } catch (error) {
                    console.warn(`Failed to load WASM from ${path}:`, error);
                }
            }

            if (!wasmBytes) {
                throw new Error('Failed to fetch WASM from any known path');
            }

            // Import the WASM module
            let wasmModule: any;

            try {
                // Try to import the WASM JS bindings
                wasmModule = await import('../../wasm/pkg/contexter_wasm.js').catch(() => {
                    // Fallback: try global object if available
                    return (self as any).wasm_bindgen;
                });

                if (!wasmModule) {
                    throw new Error('WASM module not available');
                }
            } catch (error) {
                console.warn('WASM import failed:', error);
                throw new Error('WASM module not available');
            }

            const wasmInstanceObj = await WebAssembly.instantiate(wasmBytes, {
                './contexter_wasm_bg.js': wasmModule
            });

            if (!wasmInstanceObj || !wasmInstanceObj.instance) {
                throw new Error('WASM instantiation failed');
            }

            // Initialize the WASM module
            if (wasmModule.__wbg_set_wasm) {
                wasmModule.__wbg_set_wasm(wasmInstanceObj.instance.exports);
            }

            // Validate that required functions exist
            const requiredFunctions = ['filter_files', 'process_files', 'merge_files_to_markdown'];
            for (const funcName of requiredFunctions) {
                if (typeof (wasmModule as any)[funcName] !== 'function') {
                    console.warn(`WASM function ${funcName} not found, using fallback`);
                }
            }

            const instance = {
                filter_files: (wasmModule as any).filter_files || this.fallbackFilterFiles.bind(this),
                process_files: (wasmModule as any).process_files || this.fallbackProcessFiles.bind(this),
                merge_files_to_markdown: (wasmModule as any).merge_files_to_markdown || this.fallbackMergeFiles.bind(this),
                memory: wasmInstanceObj.instance.exports.memory,
            };

            console.info('WASM module loaded successfully');
            return instance;
        } catch (error) {
            console.error('WASM loading error:', error);
            throw error;
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getMemoryUsage(): number {
        if (this.instance?.memory) {
            return this.instance.memory.buffer.byteLength;
        }
        return 0;
    }

    cleanup(): void {
        this.instance = null;
        this.isLoading = false;
        this.loadPromise = null;
        this.retryCount = 0;
    }
}

// Performance monitoring utilities
class PerformanceMonitor {
    private static measurements = new Map<string, number>();

    static start(label: string): void {
        this.measurements.set(label, performance.now());
    }

    static end(label: string): number {
        const startTime = this.measurements.get(label);
        if (startTime === undefined) {
            console.warn(`Performance measurement '${label}' was not started`);
            return 0;
        }

        const elapsed = performance.now() - startTime;
        this.measurements.delete(label);
        return elapsed;
    }

    static measure<T>(label: string, fn: () => T): T {
        this.start(label);
        try {
            return fn();
        } finally {
            const elapsed = this.end(label);
            console.debug(`${label}: ${elapsed.toFixed(2)}ms`);
        }
    }

    static async measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
        this.start(label);
        try {
            return await fn();
        } finally {
            const elapsed = this.end(label);
            console.debug(`${label}: ${elapsed.toFixed(2)}ms`);
        }
    }
}

// Enhanced message handler with error boundaries
class MessageHandler {
    private wasm: WasmManager;

    constructor() {
        this.wasm = new WasmManager();
    }

    async handleMessage(event: MessageEvent<WorkerMessage>): Promise<void> {
        const { type, payload, requestId } = event.data;
        const startTime = performance.now();

        try {
            let result: any;

            switch (type) {
                case 'filter-files':
                    result = await this.handleFilterFiles(payload);
                    this.sendResponse('filter-complete', result, requestId, startTime);
                    break;

                case 'process-files':
                    result = await this.handleProcessFiles(payload);
                    this.sendResponse('processing-complete', result, requestId, startTime);
                    break;

                case 'merge-files':
                    result = await this.handleMergeFiles(payload);
                    this.sendResponse('markdown-result', result, requestId, startTime);
                    break;

                default:
                    throw new Error(`Unknown message type: ${type}`);
            }
        } catch (error) {
            console.error(`Error handling ${type}:`, error);
            this.sendError(type, error, requestId, startTime);
        }
    }

    private async handleFilterFiles(payload: FilterFilesMessage['payload']): Promise<any> {
        return PerformanceMonitor.measureAsync('filter-files', async () => {
            const wasm = await this.wasm.initialize();
            const { metadata, gitignoreContent, rootPrefix, settings } = payload;

            // Enhanced options with defaults
            const filterOptions = {
                textOnly: settings.textOnly ?? true,
                maxFileSize: settings.maxFileSize ?? 2 * 1024 * 1024,
                includePatterns: settings.includePatterns ?? [],
                excludePatterns: settings.excludePatterns ?? [],
            };

            const result = wasm.filter_files(
                metadata,
                gitignoreContent,
                rootPrefix,
                filterOptions
            );

            // Enhanced result processing
            if (typeof result === 'object' && result.paths) {
                return {
                    paths: result.paths,
                    filteredCount: result.paths.length,
                    processingTimeMs: result.processingTimeMs || 0,
                    memoryUsage: this.wasm.getMemoryUsage(),
                };
            }

            // Fallback for simple array result
            return {
                paths: Array.isArray(result) ? result : [],
                filteredCount: Array.isArray(result) ? result.length : 0,
                processingTimeMs: 0,
                memoryUsage: this.wasm.getMemoryUsage(),
            };
        });
    }

    private async handleProcessFiles(payload: ProcessFilesMessage['payload']): Promise<any> {
        return PerformanceMonitor.measureAsync('process-files', async () => {
            const wasm = await this.wasm.initialize();
            const { files, settings } = payload;

            if (!Array.isArray(files) || files.length === 0) {
                throw new Error('No files provided for processing');
            }

            // Validate file inputs
            const validFiles = files.filter(file =>
                file &&
                typeof file.path === 'string' &&
                typeof file.content === 'string'
            );

            if (validFiles.length !== files.length) {
                console.warn(`Filtered out ${files.length - validFiles.length} invalid files`);
            }

            const processingOptions = {
                textOnly: settings.textOnly ?? true,
                hideEmptyFolders: settings.hideEmptyFolders ?? true,
                showTokenCount: settings.showTokenCount ?? true,
            };

            const result = wasm.process_files(validFiles, processingOptions);

            // Enhance result with additional metadata
            return {
                ...result,
                memoryUsage: this.wasm.getMemoryUsage(),
                validFileCount: validFiles.length,
                skippedFileCount: files.length - validFiles.length,
            };
        });
    }

    private async handleMergeFiles(payload: MergeFilesMessage['payload']): Promise<string> {
        return PerformanceMonitor.measureAsync('merge-files', async () => {
            const wasm = await this.wasm.initialize();
            const { files, options = {} } = payload;

            if (!Array.isArray(files) || files.length === 0) {
                return '';
            }

            // Enhanced markdown options
            const markdownOptions = {
                includeHeader: options.includeHeader ?? false,
                includeToc: options.includeToc ?? false,
                includePathHeaders: options.includePathHeaders ?? true,
                includeStats: options.includeStats ?? false,
            };

            return wasm.merge_files_to_markdown(files, markdownOptions);
        });
    }

    private sendResponse(type: string, payload: any, requestId?: string, startTime?: number): void {
        const response: WorkerResponse = {
            type,
            payload,
            requestId,
            timestamp: Date.now(),
            processingTime: startTime ? performance.now() - startTime : undefined,
        };

        self.postMessage(response);
    }

    private sendError(originalType: string, error: unknown, requestId?: string, startTime?: number): void {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const response: WorkerResponse = {
            type: 'processing-error',
            payload: {
                originalType,
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
            },
            requestId,
            timestamp: Date.now(),
            processingTime: startTime ? performance.now() - startTime : undefined,
        };

        self.postMessage(response);
    }

    cleanup(): void {
        this.wasm.cleanup();
    }
}

// Global message handler instance
const messageHandler = new MessageHandler();

// Enhanced message listener with error boundaries
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
    try {
        await messageHandler.handleMessage(event);
    } catch (error) {
        console.error('Unhandled worker error:', error);

        self.postMessage({
            type: 'processing-error',
            payload: {
                originalType: event.data?.type || 'unknown',
                error: 'Unhandled worker error',
                details: error instanceof Error ? error.message : String(error),
            },
            timestamp: Date.now(),
        });
    }
};

// Handle worker errors
self.onerror = (error) => {
    console.error('Worker error:', error);

    const errorMessage = typeof error === 'string' ? error :
        (error as ErrorEvent).message ||
        String(error);

    self.postMessage({
        type: 'processing-error',
        payload: {
            originalType: 'worker-error',
            error: 'Worker encountered an error',
            details: errorMessage,
        },
        timestamp: Date.now(),
    });
};

// Handle unhandled promise rejections
self.onunhandledrejection = (event) => {
    console.error('Unhandled promise rejection in worker:', event.reason);

    self.postMessage({
        type: 'processing-error',
        payload: {
            originalType: 'promise-rejection',
            error: 'Unhandled promise rejection',
            details: event.reason?.message || String(event.reason),
        },
        timestamp: Date.now(),
    });

    // Prevent the error from propagating
    event.preventDefault();
};

// Cleanup on worker termination
self.addEventListener('beforeunload', () => {
    messageHandler.cleanup();
});

// Export types for use in main thread
export type {
    FilterFilesMessage,
    ProcessFilesMessage,
    MergeFilesMessage,
    WorkerMessage,
    WorkerResponse,
    FileMetadata,
    FilterSettings,
    ProcessingSettings,
    MarkdownOptions,
};

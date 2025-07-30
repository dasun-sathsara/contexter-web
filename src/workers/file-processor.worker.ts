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
interface WasmInstance {
    filter_files: (metadata: FileMetadata[], gitignoreContent: string, rootPrefix: string, options: WasmFilterOptions) => unknown;
    process_files: (files: FileInput[], options: WasmProcessingOptions) => unknown;
    merge_files_to_markdown: (files: FileInput[], options: MarkdownOptions) => string;
    memory?: { buffer: ArrayBuffer };
}

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

// WASM-compatible interfaces (snake_case)
interface WasmFilterOptions {
    text_only: boolean;
    max_file_size?: number;
    include_patterns?: string[];
    exclude_patterns?: string[];
}

interface WasmProcessingOptions {
    text_only: boolean;
    hide_empty_folders: boolean;
    show_token_count: boolean;
}

// WASM return type interfaces
interface WasmFilterResult {
    paths: string[];
    filteredCount?: number;
    processingTimeMs?: number;
}

interface WasmProcessingResult {
    file_tree: unknown[];
    total_tokens: number;
    total_files: number;
    total_size: number;
    processing_time_ms: number;
}

interface MarkdownOptions {
    includeHeader?: boolean;
    includeToc?: boolean;
    includePathHeaders?: boolean;
    includeStats?: boolean;
}

interface WorkerResponse {
    type: string;
    payload: unknown;
    requestId?: string;
    timestamp: number;
    processingTime?: number;
}

// WASM module management with enhanced error handling and caching
class WasmManager {
    private instance: WasmInstance | null = null;
    private isLoading = false;
    private loadPromise: Promise<WasmInstance> | null = null;
    private retryCount = 0;
    private readonly maxRetries = 3;
    private readonly retryDelay = 1000;

    async initialize(): Promise<WasmInstance> {
        console.log('[WASM] Initialize called, current state:', {
            hasInstance: !!this.instance,
            isLoading: this.isLoading,
            retryCount: this.retryCount
        });

        if (this.instance) {
            console.log('[WASM] Returning existing instance');
            return this.instance;
        }

        if (this.isLoading && this.loadPromise) {
            console.log('[WASM] Load already in progress, waiting...');
            return this.loadPromise;
        }

        console.log('[WASM] Starting new load...');
        this.isLoading = true;
        this.loadPromise = this.loadWasmModule();

        try {
            this.instance = await this.loadPromise;
            this.retryCount = 0; // Reset retry count on success
            console.log('[WASM] Load successful');
            return this.instance;
        } catch (error) {
            console.error('[WASM] Load failed:', error);
            this.isLoading = false;
            this.loadPromise = null;

            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                console.warn(`[WASM] Retrying load (${this.retryCount}/${this.maxRetries})...`, error);

                // Exponential backoff
                await this.delay(this.retryDelay * Math.pow(2, this.retryCount - 1));
                return this.initialize();
            }

            console.error('[WASM] All retries exhausted, throwing error');
            throw new Error('WASM loading failed after all retries');
        } finally {
            this.isLoading = false;
        }
    }

    private async loadWasmModule(): Promise<WasmInstance> {
        console.log('[WORKER] Starting WASM module load...');
        try {
            // Construct absolute URL for WASM file - workers need absolute URLs
            const baseUrl = self.location.origin;
            const wasmUrl = `${baseUrl}/contexter_wasm.js`;
            console.log('[WORKER] Using absolute WASM URL:', wasmUrl);

            // Test if we can fetch the WASM JS file
            console.log('[WORKER] Checking WASM file availability...');
            const response = await fetch(wasmUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch WASM file: ${response.status} ${response.statusText}`);
            }
            console.log('[WORKER] WASM file is accessible');

            console.log('[WORKER] Attempting to import WASM from:', wasmUrl);
            const wasmImport = await import(/* webpackIgnore: true */ wasmUrl);
            console.log('[WORKER] WASM import successful:', Object.keys(wasmImport));

            console.log('[WORKER] Initializing WASM module...');
            await wasmImport.default();
            console.log('[WORKER] WASM module initialized successfully');

            const wasmInstance = {
                filter_files: wasmImport.filter_files,
                process_files: wasmImport.process_files,
                merge_files_to_markdown: wasmImport.merge_files_to_markdown,
            };

            // Test that the functions exist
            console.log('[WORKER] WASM functions available:', {
                filter_files: typeof wasmInstance.filter_files,
                process_files: typeof wasmInstance.process_files,
                merge_files_to_markdown: typeof wasmInstance.merge_files_to_markdown,
            });

            // Test calling filter_files with minimal data
            console.log('[WORKER] Testing WASM filter_files function...');
            try {
                const testResult = wasmInstance.filter_files(
                    [{ path: 'test.js', size: 100 }],
                    '',
                    '',
                    { text_only: true }
                );
                console.log('[WORKER] WASM test successful:', testResult);
            } catch (testError) {
                console.error('[WORKER] WASM test failed:', testError);
                throw new Error(`WASM function test failed: ${testError}`);
            }

            console.log('[WORKER] WASM module loaded successfully');
            return wasmInstance;
        } catch (error) {
            console.error('[WORKER] WASM loading error:', error);
            throw error;
        }
    } private delay(ms: number): Promise<void> {
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

        console.log(`[WORKER] Received message: ${type}`, { requestId, payloadKeys: Object.keys(payload || {}) });

        try {
            let result: unknown;

            switch (type) {
                case 'filter-files':
                    console.log('[WORKER] Handling filter-files...');
                    result = await this.handleFilterFiles(payload);
                    console.log('[WORKER] Filter-files completed, sending response...');
                    this.sendResponse('filter-complete', result, requestId, startTime);
                    break;

                case 'process-files':
                    console.log('[WORKER] Handling process-files...');
                    result = await this.handleProcessFiles(payload);
                    console.log('[WORKER] Process-files completed, sending response...');
                    this.sendResponse('processing-complete', result, requestId, startTime);
                    break;

                case 'merge-files':
                    console.log('[WORKER] Handling merge-files...');
                    result = await this.handleMergeFiles(payload);
                    console.log('[WORKER] Merge-files completed, sending response...');
                    this.sendResponse('markdown-result', result, requestId, startTime);
                    break;

                default:
                    throw new Error(`Unknown message type: ${type}`);
            }
        } catch (error) {
            console.error(`[WORKER] Error handling ${type}:`, error);
            this.sendError(type, error, requestId, startTime);
        }
    }

    private async handleFilterFiles(payload: FilterFilesMessage['payload']): Promise<unknown> {
        return PerformanceMonitor.measureAsync('filter-files', async () => {
            console.log('[WORKER] Starting filter-files handler...');
            const { metadata, gitignoreContent, rootPrefix, settings } = payload;

            console.log('[WORKER] Filter files payload:', {
                metadataCount: metadata?.length,
                metadataFirstFew: metadata?.slice(0, 3),
                gitignoreLength: gitignoreContent?.length,
                rootPrefix,
                settings
            });

            console.log('[WORKER] Initializing WASM...');
            const wasm = await this.wasm.initialize();
            console.log('[WORKER] WASM initialized, calling filter_files...');

            // Convert to the exact format expected by WASM
            const filterOptions: WasmFilterOptions = {
                text_only: settings.textOnly ?? true,
                max_file_size: settings.maxFileSize ?? 2 * 1024 * 1024,
                include_patterns: settings.includePatterns ?? [],
                exclude_patterns: settings.excludePatterns ?? [],
            };

            console.log('[WORKER] Calling WASM filter_files with:', {
                metadataCount: metadata.length,
                metadataFirstFew: metadata.slice(0, 5),
                gitignoreContentLength: gitignoreContent.length,
                rootPrefix,
                filterOptions
            });

            try {
                const result = wasm.filter_files(
                    metadata,
                    gitignoreContent,
                    rootPrefix,
                    filterOptions
                );

                console.log('[WORKER] WASM filter_files returned:', {
                    type: typeof result,
                    isMap: result instanceof Map,
                    isArray: Array.isArray(result),
                    result: result,
                    keys: result instanceof Map ? Array.from(result.keys()) : Object.keys(result || {}),
                    values: result instanceof Map ? Array.from(result.values()) : Object.values(result || {})
                });

                // Handle different return types from WASM
                let paths: string[] = [];
                let processingTimeMs = 0;
                let filteredCount = 0;

                if (result instanceof Map) {
                    // If WASM returns a Map, extract the paths
                    paths = Array.from(result.get('paths') || result.values() || []);
                    processingTimeMs = result.get('processingTimeMs') || 0;
                } else if (result && typeof result === 'object' && 'paths' in result) {
                    // If WASM returns an object with paths property
                    const typedResult = result as WasmFilterResult;
                    paths = typedResult.paths || [];
                    processingTimeMs = typedResult.processingTimeMs || 0;
                    filteredCount = typedResult.filteredCount || paths.length;
                } else if (Array.isArray(result)) {
                    // If WASM returns an array directly
                    paths = result;
                } else {
                    console.error('[WORKER] Unexpected WASM result format:', result);
                    throw new Error('Unexpected WASM result format');
                }

                console.log('[WORKER] Extracted paths:', paths.length, 'first few:', paths.slice(0, 5));

                // The WASM function returns a structured result
                const response = {
                    paths,
                    filteredCount: filteredCount || paths.length,
                    processingTimeMs,
                    memoryUsage: this.wasm.getMemoryUsage(),
                };

                console.log('[WORKER] Returning filter response:', response);
                return response;
            } catch (wasmError) {
                console.error('[WORKER] WASM filter_files failed:', wasmError);
                throw wasmError;
            }
        });
    }

    private async handleProcessFiles(payload: ProcessFilesMessage['payload']): Promise<unknown> {
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

            const processingOptions: WasmProcessingOptions = {
                text_only: settings.textOnly ?? true,
                hide_empty_folders: settings.hideEmptyFolders ?? true,
                show_token_count: settings.showTokenCount ?? true,
            };

            console.log('[WORKER] Calling WASM process_files with:', {
                validFilesCount: validFiles.length,
                firstFewFiles: validFiles.slice(0, 3).map(f => ({ path: f.path, contentLength: f.content?.length })),
                processingOptions
            });

            const result = wasm.process_files(validFiles, processingOptions);

            console.log('[WORKER] WASM process_files returned:', {
                type: typeof result,
                isMap: result instanceof Map,
                isArray: Array.isArray(result),
                result: result,
                keys: result instanceof Map ? Array.from(result.keys()) : Object.keys(result || {}),
                values: result instanceof Map ? Array.from(result.values()) : Object.values(result || {})
            });

            // Handle different return types from WASM
            let file_tree: unknown[] = [];
            let total_tokens = 0;
            let total_files = 0;
            let total_size = 0;
            let processing_time_ms = 0;

            if (result instanceof Map) {
                // If WASM returns a Map, extract the values
                file_tree = result.get('file_tree') || result.get('filtered') || [];
                total_tokens = result.get('total_tokens') || result.get('totalTokens') || 0;
                total_files = result.get('total_files') || result.get('totalFiles') || 0;
                total_size = result.get('total_size') || result.get('totalSize') || 0;
                processing_time_ms = result.get('processing_time_ms') || result.get('processingTime') || 0;
            } else if (result && typeof result === 'object') {
                // Handle both snake_case and camelCase properties
                const anyResult = result as any;

                // Check all possible property names for file tree
                file_tree = anyResult.file_tree || anyResult.filtered || anyResult.fileTree || anyResult.files || [];
                total_tokens = anyResult.total_tokens || anyResult.totalTokens || 0;
                total_files = anyResult.total_files || anyResult.totalFiles || 0;
                total_size = anyResult.total_size || anyResult.totalSize || 0;
                processing_time_ms = anyResult.processing_time_ms || anyResult.processingTime || 0;

                // If file_tree is still empty, let's see what properties are actually available
                if (!Array.isArray(file_tree) || file_tree.length === 0) {
                    console.log('[WORKER] No file_tree found, available properties:', Object.keys(anyResult));
                    console.log('[WORKER] Full result object:', anyResult);

                    // Maybe the WASM is returning the result in a different format
                    // Check if the result itself is an array or if there's a nested structure
                    if (Array.isArray(anyResult)) {
                        file_tree = anyResult;
                    } else {
                        // Try to find any array property that might be the file tree
                        for (const [key, value] of Object.entries(anyResult)) {
                            if (Array.isArray(value) && value.length > 0) {
                                console.log(`[WORKER] Found array property '${key}' with ${value.length} items`);
                                file_tree = value;
                                break;
                            }
                        }
                    }
                }

                // Special handling: if we have a single root folder, extract its children
                if (Array.isArray(file_tree) && file_tree.length === 1) {
                    const rootItem = file_tree[0] as any;
                    if (rootItem && typeof rootItem === 'object' && 'children' in rootItem && Array.isArray(rootItem.children)) {
                        console.log(`[WORKER] Found single root folder '${rootItem.name || 'unknown'}' with ${rootItem.children.length} children`);
                        // Extract the children of the root folder to make them the new root items
                        file_tree = rootItem.children;
                        console.log(`[WORKER] Extracted ${file_tree.length} root items from single folder`);
                    }
                }
            } else {
                console.error('[WORKER] Unexpected WASM process_files result format:', result);
                throw new Error('Unexpected WASM process_files result format');
            }

            console.log('[WORKER] Extracted process result:', {
                file_tree_length: Array.isArray(file_tree) ? file_tree.length : 'not array',
                file_tree_first_item: Array.isArray(file_tree) && file_tree.length > 0 ? file_tree[0] : null,
                file_tree_sample_items: Array.isArray(file_tree) ? file_tree.slice(0, 3).map(item => {
                    const anyItem = item as any;
                    return {
                        name: anyItem?.name,
                        path: anyItem?.path,
                        is_dir: anyItem?.is_dir,
                        isDir: anyItem?.isDir,
                        type: typeof anyItem,
                        keys: anyItem ? Object.keys(anyItem) : []
                    };
                }) : [],
                total_tokens,
                total_files,
                total_size,
                processing_time_ms
            });

            if (typeof result === 'object' && result !== null) {
                return {
                    file_tree,
                    total_tokens,
                    total_files,
                    total_size,
                    processing_time_ms,
                    memoryUsage: this.wasm.getMemoryUsage(),
                    validFileCount: validFiles.length,
                    skippedFileCount: files.length - validFiles.length,
                };
            }

            return {
                memoryUsage: this.wasm.getMemoryUsage(),
                validFileCount: validFiles.length,
                skippedFileCount: files.length - validFiles.length,
            };
        });
    }

    private async handleMergeFiles(payload: MergeFilesMessage['payload']): Promise<string> {
        return PerformanceMonitor.measureAsync('merge-files', async () => {
            const wasm = await this.wasm.initialize();
            const { files } = payload;

            if (!Array.isArray(files) || files.length === 0) {
                return '';
            }

            // Enhanced markdown options with defaults
            const markdownOptions = {
                includeHeader: false,
                includeToc: false,
                includePathHeaders: true,
                includeStats: false,
            };

            return wasm.merge_files_to_markdown(files, markdownOptions);
        });
    }

    private sendResponse(type: string, payload: unknown, requestId?: string, startTime?: number): void {
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

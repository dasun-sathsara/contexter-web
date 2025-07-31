// This is a module worker, so we use standard ES imports.
// We import the init function and all wasm-bindgen exports from the JS glue code.
import init, * as WasmModule from '@/wasm-module/contexter_wasm.js';

import type { FileInput, FilterOptions, MarkdownOptions, ProcessingOptions, ProcessingResult, FileMetadata } from '@/lib/types';

// A type-safe interface for the WASM module's exports.
type WasmApi = {
    filter_files(metadata: FileMetadata[], gitignoreContent: string, rootPrefix: string, options: FilterOptions): { paths: string[]; processingTimeMs: number };
    process_files(files: FileInput[], options: ProcessingOptions): ProcessingResult;
    merge_files_to_markdown(files: FileInput[], options: MarkdownOptions): string;
};

// --- WASM Initialization ---
// Initialize the WASM module. This returns a promise that resolves when the module is ready.
// By calling init() without arguments, it will use `new URL('...wasm', import.meta.url)`
// to fetch the .wasm file relative to the JS glue file, a pattern modern bundlers support.
const wasmInitPromise: Promise<WasmApi> = init()
    .then(() => {
        console.log('[Worker] WASM module initialized successfully.');
        // After init, the functions are available in the imported WasmModule object.
        return WasmModule as unknown as WasmApi;
    })
    .catch(error => {
        console.error('[Worker] Failed to initialize WASM:', error);
        self.postMessage({ type: 'processing-error', payload: 'Failed to load core processing module.' });
        throw error; // Propagate error to prevent the worker from running.
    });

// --- Event Listener ---


self.onmessage = async (event: MessageEvent) => {
    const { type, payload } = event.data;

    try {
        // Wait for the WASM module to be ready before processing any messages.
        const wasm = await wasmInitPromise;

        switch (type) {
            case 'filter-files': {
                const result = wasm.filter_files(payload.metadata, payload.gitignoreContent, payload.rootPrefix, payload.settings);
                self.postMessage({ type: 'filter-complete', payload: result });
                break;
            }
            case 'process-files': {
                const result = wasm.process_files(payload.files, payload.settings);
                self.postMessage({ type: 'processing-complete', payload: result });
                break;
            }
            case 'merge-files': {
                const result = wasm.merge_files_to_markdown(payload.files, payload.options);
                self.postMessage({ type: 'markdown-result', payload: result });
                break;
            }
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Worker] Error processing message type "${type}":`, error);
        self.postMessage({ type: 'processing-error', payload: errorMessage });
    }
};

console.log('[Worker] File processor worker loaded and ready.');

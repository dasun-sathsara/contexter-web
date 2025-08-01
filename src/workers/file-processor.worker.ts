import init, * as WasmModule from '@/wasm-module/contexter_wasm.js';

import type { FileNode, FileInput, FilterOptions, MarkdownOptions, ProcessingOptions, ProcessingResult, FileMetadata } from '@/lib/types';

type WasmApi = {
    filter_files(metadata: FileMetadata[], gitignoreContent: string, rootPrefix: string, options: FilterOptions): { paths: string[]; processingTimeMs: number };
    process_files(files: FileInput[], options: ProcessingOptions): ProcessingResult;
    merge_files_to_markdown(files: FileInput[], options: MarkdownOptions): string;
    recalculate_counts(tree: FileNode[], options: ProcessingOptions): FileNode[];
};

const wasmInitPromise: Promise<WasmApi> = init()
    .then(() => {
        console.log('[Worker] WASM module initialized successfully.');
        return WasmModule as unknown as WasmApi;
    })
    .catch(error => {
        console.error('[Worker] Failed to initialize WASM:', error);
        self.postMessage({ type: 'processing-error', payload: 'Failed to load core processing module.' });
        throw error;
    });

self.onmessage = async (event: MessageEvent) => {
    const { type, payload } = event.data;

    try {
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
            case 'recalculate-counts': {
                const { fileTree, settings } = payload;
                const result = wasm.recalculate_counts(fileTree, settings);
                self.postMessage({ type: 'recalculation-complete', payload: { fileTree: result } });
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

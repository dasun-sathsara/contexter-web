import { FileInput } from '@/lib/types';

interface Settings {
    textOnly: boolean;
    hideEmptyFolders: boolean;
    showTokenCount: boolean;
}

let wasmInstance: any = null;

async function loadWasm() {
    if (!wasmInstance) {
        try {
            const wasmResponse = await fetch(`${self.location.origin}/contexter_wasm_bg.wasm`);
            const wasmBytes = await wasmResponse.arrayBuffer();
            const wasmModule = await import('../../wasm/pkg/contexter_wasm_bg.js');
            const wasmInstanceObj = await WebAssembly.instantiate(wasmBytes, {
                './contexter_wasm_bg.js': wasmModule
            });
            wasmModule.__wbg_set_wasm(wasmInstanceObj.instance.exports);

            wasmInstance = {
                filter_files: wasmModule.filter_files, // Updated function name
                process_files: wasmModule.process_files,
                merge_files_to_markdown: wasmModule.merge_files_to_markdown
            };
        } catch (error) {
            console.error('Failed to load WASM:', error);
            throw error;
        }
    }
    return wasmInstance;
}

self.onmessage = async (event: MessageEvent) => {
    const { type, payload } = event.data;

    try {
        const wasm = await loadWasm();

        if (type === 'filter-files') {
            const { metadata = [], gitignoreContent = '', rootPrefix = '', settings = {} } = payload;
            const { textOnly = true } = settings;

            const keptPaths = wasm.filter_files(metadata, gitignoreContent, rootPrefix, textOnly);
            self.postMessage({ type: 'filter-complete', payload: keptPaths });

        } else if (type === 'process-files') {
            const { files, settings }: { files: FileInput[]; settings: Settings } = payload;
            const result = wasm.process_files(files, settings.textOnly, settings.hideEmptyFolders, settings.showTokenCount);
            self.postMessage({ type: 'processing-complete', payload: result });

        } else if (type === 'merge-files') {
            const files: FileInput[] = payload;
            const markdown = wasm.merge_files_to_markdown(files);
            self.postMessage({ type: 'markdown-result', payload: markdown });
        }
    } catch (e) {
        console.error(`Error in worker for type ${type}:`, e);
        self.postMessage({ type: 'processing-error', payload: (e as Error).message });
    }
};

declare module '*.wasm' {
    const src: string;
    export default src;
}

declare module '*.wasm?url' {
    const src: string;
    export default src;
}

declare module '/contexter_wasm.js' {
    export default function init(): Promise<void>;
    export function merge_files_to_markdown(files: unknown, options: unknown): string;
    export function filter_files(metadata: unknown, gitignoreContent: string, rootPrefix: string, options: unknown): unknown;
    export function process_files(files: unknown, options: unknown): unknown;
}

declare module 'worker-loader!*' {
    class WebpackWorker extends Worker {
        constructor();
    }
    export default WebpackWorker;
}

declare module '*.worker.ts' {
    class WebpackWorker extends Worker {
        constructor();
    }
    export default WebpackWorker;
}

declare global {
    namespace React {
        interface InputHTMLAttributes<T extends HTMLInputElement = HTMLInputElement> {
            webkitdirectory?: string;
        }
    }
}

export { };

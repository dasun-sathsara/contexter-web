declare module '*.wasm' {
    const src: string;
    export default src;
}

declare module '*.wasm?url' {
    const src: string;
    export default src;
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

export {};

declare global {
    namespace React {
        interface InputHTMLAttributes {
            webkitdirectory?: string;
        }
    }
}

declare module '*.worker.ts' {
    class WebpackWorker extends Worker {
        constructor();
    }
    export default WebpackWorker;
}

export { };

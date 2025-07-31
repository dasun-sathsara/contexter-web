// This file is now much simpler.
// It mainly provides global types that might be used across the app.

// Allows using `webkitdirectory` on input elements for folder selection.
declare global {
    namespace React {
        interface InputHTMLAttributes<T extends HTMLInputElement = HTMLInputElement> {
            webkitdirectory?: string;
        }
    }
}

// Handles imports for web workers with modern bundlers.
declare module '*.worker.ts' {
    class WebpackWorker extends Worker {
        constructor();
    }
    export default WebpackWorker;
}

// Required to make this file a module.
export { };

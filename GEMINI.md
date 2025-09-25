# GEMINI.md

## Project Overview

This is a Next.js web application that provides a client-side utility for preparing code files for use with Large Language Models (LLMs). The application is designed to be high-performance and privacy-focused, with all file processing done in the browser.

The core processing logic is written in Rust and compiled to WebAssembly (WASM). This allows for fast and efficient analysis of large projects without blocking the UI. The application uses Web Workers to run the WASM module and perform other background tasks, ensuring a responsive user experience.

The frontend is built with React and Next.js, and uses Tailwind CSS for styling. The application state is managed with Zustand.

## Building and Running

The project uses `pnpm` as the package manager. The following scripts are available in `package.json`:

*   `pnpm dev`: Starts the development server.
*   `pnpm build`: Builds the application for production.
*   `pnpm start`: Starts the production server.
*   `pnpm lint`: Lints the codebase.

Before running `dev` or `build`, the `copy-wasm` script is executed to copy the WASM module to the correct location.

The Rust-based WASM module can be built by navigating to the `wasm` directory and running `wasm-pack build`.

## Development Conventions

*   **Code Style:** The project uses ESLint for linting and Prettier for code formatting.
*   **State Management:** The application uses Zustand for global state management. The main store is located in `src/stores/file-store.ts`.
*   **Web Workers:** The application makes extensive use of Web Workers to offload heavy computations from the main thread. The worker code is located in the `src/workers` directory.
*   **WebAssembly:** The core file processing logic is written in Rust and compiled to WebAssembly. The Rust code is located in the `wasm` directory. The `wasm-bindgen` tool is used to generate the JavaScript bindings for the WASM module.
*   **Keybindings:** The application supports both standard and Vim-style keybindings. The keybinding logic is implemented in the `src/hooks/use-keybindings.ts` hook.

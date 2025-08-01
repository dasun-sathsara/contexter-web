# Contexter Web

A Next.js application for processing and visualizing project file structures with WebAssembly-powered analysis.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Features

-   **File Processing**: Drag and drop folders to analyze project structure
-   **WASM Integration**: High-performance file processing using Rust/WebAssembly
-   **Vim-style Navigation**: Keyboard shortcuts for efficient file browsing
-   **Token Counting**: Built-in token analysis for text files
-   **Gitignore Support**: Respects .gitignore rules during processing

## Tech Stack

-   **Frontend**: Next.js 15, React 19, TypeScript
-   **Styling**: Tailwind CSS with custom design system
-   **State Management**: Zustand with persistence
-   **File Processing**: Rust/WebAssembly via wasm-pack
-   **UI Components**: Radix UI primitives

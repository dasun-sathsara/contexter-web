# Contexter Web

Contexter Web is a browser-based utility designed to help developers prepare code files for use with Large Language Models (LLMs). It provides a high-performance, privacy-focused environment for selecting, analyzing, and packaging project files directly in the browser, with no server-side processing.

The application leverages Rust compiled to WebAssembly (WASM) for core processing tasks, ensuring a fast and responsive user experience even with large projects.

## Features

-   **Purely Client-Side:** All file processing happens locally in your browser. No files are ever uploaded to a server, ensuring your code remains private.
-   **High-Performance Processing:** Core logic is written in Rust and executed as a WASM module within a Web Worker, preventing UI blocking and enabling fast analysis.
-   **`.gitignore` Aware:** Automatically respects `.gitignore` rules within the uploaded project to exclude irrelevant files.
-   **Token Counting:** Calculates and displays token counts for individual files and entire directories using the `cl100k_base` (GPT-4) tokenizer.
-   **Vim-Style Keybindings:** Navigate, select, and manage files efficiently using a comprehensive set of keyboard shortcuts.
-   **File Merging:** Combine the contents of selected files and directories into a single, LLM-ready Markdown block for easy copy-pasting.
-   **Syntax-Highlighted Preview:** Quickly inspect file contents in a modal with syntax highlighting.
-   **Customizable Interface:** Toggle the visibility of token counts and empty folders to suit your workflow.

## Keybindings

The interface is designed for keyboard-first operation.

### General Navigation & Selection

These commands work in **Normal Mode**.

| Key(s)             | Action                                                     |
| ------------------ | ---------------------------------------------------------- |
| `j` / `ArrowDown`  | Move cursor down                                           |
| `k` / `ArrowUp`    | Move cursor up                                             |
| `h` / `ArrowLeft`  | Navigate to the parent directory                           |
| `l` / `ArrowRight` | Navigate into the selected directory                       |
| `Enter`            | Navigate into the selected directory                       |
| `g`                | Go to the first item in the list                           |
| `G`                | Go to the last item in the list                            |
| ` ` (Space)        | Toggle selection for the item under the cursor             |
| `v` / `V`          | Enter **Visual Mode** to select a range of items           |
| `y`                | Yank (copy) selected items to clipboard in Markdown format |
| `d`                | Delete selected items from the current view                |
| `o`                | Open a preview modal for the selected file                 |
| `Escape`           | Clear all selections or exit Visual Mode                   |
| `Shift` + `C`      | Clear the entire project and reset the application         |

### Visual Mode

Enter Visual Mode with `v` or `V`. This mode is for selecting contiguous blocks of files.

| Key(s)    | Action                                 |
| --------- | -------------------------------------- |
| `j` / `k` | Expand selection up or down            |
| `g` / `G` | Expand selection to the start or end   |
| `y`       | Yank (copy) the selection to clipboard |
| `d`       | Delete the selection from the view     |
| `Escape`  | Exit Visual Mode and return to Normal  |

### File Preview Modal

When the file preview is open:

| Key      | Action                            |
| -------- | --------------------------------- |
| `y`      | Copy the full content of the file |
| `Escape` | Close the preview modal           |

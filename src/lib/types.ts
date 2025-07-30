export interface FileNode {
    path: string;
    name: string;
    is_dir: boolean;
    token_count?: number;
    children: FileNode[];
    size?: number;
    last_modified?: number;
}

export interface ProcessingResult {
    file_tree: FileNode[];
    total_tokens: number;
    total_files: number;
    total_size?: number;
    processing_time_ms?: number;
}

export interface FileInput {
    path: string;
    content: string;
}

export type VimMode = 'normal' | 'visual';

export interface Settings {
    hideEmptyFolders: boolean;
    showTokenCount: boolean;
    maxFileSize?: number;
    autoSave?: boolean;
}

export interface ProcessingStats {
    totalFiles: number;
    totalTokens: number;
    totalSize: number;
    processingTime: number;
    lastProcessed: Date;
}

export interface FilterOptions {
    textOnly: boolean;
    maxFileSize?: number;
    includePatterns?: string[];
    excludePatterns?: string[];
}

export interface MarkdownOptions {
    includeHeader?: boolean;
    includeToc?: boolean;
    includePathHeaders?: boolean;
    includeStats?: boolean;
}

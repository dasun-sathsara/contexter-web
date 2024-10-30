export interface FileNode {
    path: string;
    name: string;
    is_dir: boolean;
    token_count?: number;
    children: FileNode[];
}

export interface ProcessingResult {
    file_tree: FileNode[];
    total_tokens: number;
    total_files: number;
}

export interface FileInput {
    path: string;
    content: string;
}

export type VimMode = 'normal' | 'visual';

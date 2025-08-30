export interface FileNode {
  path: string;
  name: string;
  is_dir: boolean;
  children: FileNode[];
  token_count?: number;
  size?: number;
}

export interface ProcessingResult {
  file_tree: FileNode[];
  total_tokens: number;
  total_files: number;
  total_size: number;
  processing_time_ms: number;
}

export interface FileInput {
  path: string;
  content: string;
}

export interface FileMetadata {
  path: string;
  size: number;
}

export type VimMode = 'normal' | 'visual';
export type KeybindingMode = 'vim' | 'standard';

/**
 * User-configurable settings that control application behavior.
 */
export interface Settings {
  hideEmptyFolders: boolean;
  showTokenCount: boolean;
  maxFileSize: number;
  keybindingMode: KeybindingMode;
}

export interface ProcessingOptions {
  hide_empty_folders: boolean;
  show_token_count: boolean;
}

export interface FilterOptions {
  text_only: boolean;
  max_file_size: number;
}

export interface MarkdownOptions {
  include_path_headers?: boolean;
}

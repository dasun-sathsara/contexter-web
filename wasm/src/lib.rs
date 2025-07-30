use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;
use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use tiktoken_rs::{cl100k_base, CoreBPE};
use path_slash::PathExt;
use std::path::Path;

// Use OnceLock for better performance and thread safety
static TIKTOKEN_ENCODER: OnceLock<CoreBPE> = OnceLock::new();

fn get_encoder() -> &'static CoreBPE {
    TIKTOKEN_ENCODER.get_or_init(|| {
        cl100k_base().expect("Failed to initialize tiktoken encoder")
    })
}

// Core data structures with better documentation and validation
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileInput {
    pub path: String,
    pub content: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileNode {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_count: Option<u32>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub children: Vec<FileNode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_modified: Option<u64>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ProcessingResult {
    pub file_tree: Vec<FileNode>,
    pub total_tokens: u32,
    pub total_files: u32,
    pub total_size: u64,
    pub processing_time_ms: u32,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct FileMetadata {
    pub path: String,
    pub size: u32,
    #[serde(default)]
    pub last_modified: Option<u64>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct FilterOptions {
    pub text_only: bool,
    pub max_file_size: Option<u32>,
    pub include_patterns: Vec<String>,
    pub exclude_patterns: Vec<String>,
}

impl Default for FilterOptions {
    fn default() -> Self {
        Self {
            text_only: true,
            max_file_size: Some(2 * 1024 * 1024), // 2MB
            include_patterns: vec![],
            exclude_patterns: vec![],
        }
    }
}

// Enhanced text file detection with configurable extensions
struct TextFileDetector {
    text_extensions: HashSet<String>,
    binary_extensions: HashSet<String>,
}

impl TextFileDetector {
    fn new() -> Self {
        let text_extensions = [
            "js", "ts", "tsx", "jsx", "json", "md", "mdx", "html", "css", "scss", "sass", "less",
            "py", "pyi", "rs", "go", "java", "c", "cpp", "cc", "cxx", "h", "hpp", "hxx",
            "hs", "lhs", "rb", "php", "sh", "bash", "zsh", "fish", "ps1", "bat", "cmd",
            "txt", "rtf", "yml", "yaml", "xml", "toml", "ini", "conf", "config",
            "dockerfile", "makefile", "cmake", "gradle", "properties", "env",
            "gitignore", "gitattributes", "editorconfig", "eslintrc", "prettierrc",
            "sql", "graphql", "gql", "proto", "thrift", "vue", "svelte", "astro",
            "elm", "ex", "exs", "erl", "hrl", "ml", "mli", "fs", "fsi", "fsx",
            "kt", "kts", "scala", "sc", "clj", "cljs", "cljc", "edn",
            "r", "rmd", "rnw", "stata", "sas", "spss", "matlab", "m",
            "tex", "bib", "cls", "sty", "dtx", "ins",
        ].iter().map(|s| s.to_lowercase()).collect();

        let binary_extensions = [
            "exe", "dll", "so", "dylib", "bin", "obj", "o", "a", "lib",
            "jpg", "jpeg", "png", "gif", "bmp", "tiff", "svg", "ico", "webp",
            "mp3", "wav", "ogg", "flac", "aac", "m4a", "wma",
            "mp4", "avi", "mkv", "mov", "wmv", "flv", "webm",
            "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
            "zip", "rar", "7z", "tar", "gz", "bz2", "xz",
            "wasm", "class", "jar", "war", "ear",
        ].iter().map(|s| s.to_lowercase()).collect();

        Self {
            text_extensions,
            binary_extensions,
        }
    }

    fn is_likely_text(&self, path: &str) -> bool {
        let path_obj = Path::new(path);
        
        // Check for known binary extensions first
        if let Some(ext) = path_obj.extension().and_then(|s| s.to_str()) {
            let ext_lower = ext.to_lowercase();
            if self.binary_extensions.contains(&ext_lower) {
                return false;
            }
            if self.text_extensions.contains(&ext_lower) {
                return true;
            }
        }

        // Special cases for files without extensions
        if let Some(filename) = path_obj.file_name().and_then(|s| s.to_str()) {
            let filename_lower = filename.to_lowercase();
            match filename_lower.as_str() {
                "license" | "readme" | "changelog" | "makefile" | "dockerfile" 
                | "gemfile" | "rakefile" | "procfile" | "cmakelists.txt" => true,
                _ => filename_lower.starts_with('.') && !filename_lower.ends_with(".lock")
            }
        } else {
            false
        }
    }
}

// Enhanced gitignore processing with better error handling
struct GitignoreProcessor {
    matcher: ignore::gitignore::Gitignore,
}

impl GitignoreProcessor {
    fn new(gitignore_content: &str, root_path: &str) -> Result<Self, String> {
        let mut builder = ignore::gitignore::GitignoreBuilder::new(root_path);
        
        if !gitignore_content.is_empty() {
            for line in gitignore_content.lines() {
                if let Err(e) = builder.add_line(None, line) {
                    web_sys::console::warn_1(&format!("Invalid gitignore line '{}': {}", line, e).into());
                }
            }
        }

        // Add common ignore patterns
        let _ = builder.add_line(None, "node_modules/");
        let _ = builder.add_line(None, ".git/");
        let _ = builder.add_line(None, "target/");
        let _ = builder.add_line(None, "dist/");
        let _ = builder.add_line(None, "build/");
        let _ = builder.add_line(None, "*.log");

        Ok(Self {
            matcher: builder.build().map_err(|e| e.to_string())?,
        })
    }

    fn should_ignore(&self, relative_path: &str) -> bool {
        self.matcher.matched(Path::new(relative_path), false).is_ignore()
    }
}

// Utility functions with better error handling
fn extract_file_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| "Unknown".to_string())
}

fn normalize_path(path: &str) -> String {
    Path::new(path).to_slash_lossy().to_string()
}

fn calculate_tokens(content: &str) -> Result<u32, String> {
    let encoder = get_encoder();
    let tokens = encoder.encode_with_special_tokens(content);
    Ok(tokens.len() as u32)
}

// Main WASM exported functions with enhanced error handling and performance

#[wasm_bindgen]
pub fn filter_files(
    metadata_js: JsValue,
    gitignore_content: String,
    root_prefix: String,
    options_js: JsValue,
) -> Result<JsValue, JsValue> {
    console_error_panic_hook::set_once();
    
    let start_time = js_sys::Date::now();
    
    let metadata: Vec<FileMetadata> = serde_wasm_bindgen::from_value(metadata_js)
        .map_err(|e| format!("Failed to parse metadata: {}", e))?;
    
    let options: FilterOptions = serde_wasm_bindgen::from_value(options_js)
        .unwrap_or_default();

    let processor = GitignoreProcessor::new(&gitignore_content, "/")
        .map_err(|e| format!("Failed to create gitignore processor: {}", e))?;
    
    let _detector = TextFileDetector::new();
    let max_size = options.max_file_size.unwrap_or(2 * 1024 * 1024);

    let kept_paths: Vec<String> = metadata
        .into_iter()
        .filter(|meta| {
            // Extract relative path for gitignore checking
            let relative_path = if !root_prefix.is_empty() && meta.path.starts_with(&root_prefix) {
                &meta.path[root_prefix.len()..].trim_start_matches('/')
            } else {
                meta.path.as_str()
            };

            // Skip if gitignore matches
            if processor.should_ignore(relative_path) {
                return false;
            }

            // Skip if file is too large
            if meta.size > max_size {
                return false;
            }

            // Skip non-text files if text_only is enabled
            if options.text_only && !TextFileDetector::new().is_likely_text(&meta.path) {
                return false;
            }

            // Apply custom include patterns
            if !options.include_patterns.is_empty() {
                let matches_include = options.include_patterns.iter()
                    .any(|pattern| meta.path.contains(pattern));
                if !matches_include {
                    return false;
                }
            }

            // Apply custom exclude patterns
            if options.exclude_patterns.iter()
                .any(|pattern| meta.path.contains(pattern)) {
                return false;
            }

            true
        })
        .map(|meta| meta.path)
        .collect();

    let processing_time = (js_sys::Date::now() - start_time) as u32;
    
    let result = serde_json::json!({
        "paths": kept_paths,
        "processingTimeMs": processing_time,
        "filteredCount": kept_paths.len()
    });

    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| format!("Failed to serialize result: {}", e).into())
}

#[wasm_bindgen]
pub fn process_files(
    files_js: JsValue,
    options_js: JsValue,
) -> Result<JsValue, JsValue> {
    console_error_panic_hook::set_once();
    
    let start_time = js_sys::Date::now();
    
    let files: Vec<FileInput> = serde_wasm_bindgen::from_value(files_js)
        .map_err(|e| format!("Failed to parse files: {}", e))?;
    
    let options: ProcessingOptions = serde_wasm_bindgen::from_value(options_js)
        .unwrap_or_default();

    let _detector = TextFileDetector::new();
    
    // Filter files with enhanced validation
    let filtered_files: Vec<&FileInput> = files.iter()
        .filter(|file| {
            // Additional binary content check as fallback
            if options.text_only {
                // Check for null bytes (indicator of binary content)
                if file.content.as_bytes().contains(&0) {
                    return false;
                }
                // Check for high ratio of non-printable characters
                let non_printable_count = file.content.chars()
                    .filter(|c| c.is_control() && !c.is_whitespace())
                    .count();
                let total_chars = file.content.chars().count();
                if total_chars > 0 && (non_printable_count as f32 / total_chars as f32) > 0.1 {
                    return false;
                }
            }
            true
        })
        .collect();

    let mut node_map: HashMap<String, FileNode> = HashMap::new();
    let mut total_size = 0u64;

    // Process files with enhanced error handling
    for file in &filtered_files {
        let normalized_path = normalize_path(&file.path);
        let file_size = file.content.len() as u64;
        total_size += file_size;

        let token_count = if options.show_token_count {
            Some(calculate_tokens(&file.content)?)
        } else {
            None
        };

        node_map.insert(normalized_path.clone(), FileNode {
            path: normalized_path.clone(),
            name: extract_file_name(&file.path),
            is_dir: false,
            token_count,
            children: vec![],
            size: Some(file_size),
            last_modified: None, // Could be added if available from JS
        });

        // Build directory hierarchy
        let mut current_path = Path::new(&normalized_path);
        while let Some(parent_path) = current_path.parent() {
            let parent_str = normalize_path(&parent_path.to_string_lossy());
            if parent_str.is_empty() || parent_str == "." {
                break;
            }

            node_map.entry(parent_str.clone()).or_insert_with(|| FileNode {
                path: parent_str.clone(),
                name: extract_file_name(&parent_str),
                is_dir: true,
                token_count: None,
                children: vec![],
                size: None,
                last_modified: None,
            });
            
            current_path = parent_path;
        }
    }

    // Build tree structure efficiently
    let mut root_nodes = Vec::new();
    let paths: Vec<String> = node_map.keys().cloned().collect();
    
    for path_str in paths {
        if let Some(parent_path) = Path::new(&path_str).parent() {
            let parent_str = normalize_path(&parent_path.to_string_lossy());
            
            if parent_str.is_empty() || parent_str == "." {
                // This is a root node
                if let Some(node) = node_map.remove(&path_str) {
                    root_nodes.push(node);
                }
            } else if let Some(child_node) = node_map.remove(&path_str) {
                if let Some(parent_node) = node_map.get_mut(&parent_str) {
                    parent_node.children.push(child_node);
                }
            }
        }
    }

    // Post-process: calculate directory tokens and apply filters
    fn post_process_node(node: &mut FileNode, options: &ProcessingOptions) -> u32 {
        if node.is_dir {
            let mut total_tokens = 0;
            let mut total_size = 0;
            
            // Process children first
            node.children.retain_mut(|child| {
                let child_tokens = post_process_node(child, options);
                total_tokens += child_tokens;
                
                if let Some(child_size) = child.size {
                    total_size += child_size;
                }
                
                // Keep non-empty directories or files
                !options.hide_empty_folders || !child.is_dir || !child.children.is_empty()
            });
            
            node.token_count = Some(total_tokens);
            node.size = Some(total_size);
            total_tokens
        } else {
            node.token_count.unwrap_or(0)
        }
    }

    let total_tokens = root_nodes.iter_mut()
        .map(|node| post_process_node(node, &options))
        .sum();

    // Sort nodes: directories first, then alphabetically
    fn sort_nodes_recursive(nodes: &mut Vec<FileNode>) {
        nodes.sort_by(|a, b| {
            match (a.is_dir, b.is_dir) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            }
        });
        
        for node in nodes.iter_mut() {
            if node.is_dir {
                sort_nodes_recursive(&mut node.children);
            }
        }
    }

    sort_nodes_recursive(&mut root_nodes);
    
    let processing_time = (js_sys::Date::now() - start_time) as u32;

    let result = ProcessingResult {
        file_tree: root_nodes,
        total_tokens,
        total_files: filtered_files.len() as u32,
        total_size,
        processing_time_ms: processing_time,
    };

    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| format!("Failed to serialize result: {}", e).into())
}

#[wasm_bindgen]
pub fn merge_files_to_markdown(
    files_js: JsValue,
    options_js: JsValue,
) -> Result<String, JsValue> {
    console_error_panic_hook::set_once();
    
    let files: Vec<FileInput> = serde_wasm_bindgen::from_value(files_js)
        .map_err(|e| format!("Failed to parse files: {}", e))?;
    
    let options: MarkdownOptions = serde_wasm_bindgen::from_value(options_js)
        .unwrap_or_default();

    if files.is_empty() {
        return Ok(String::new());
    }

    let mut output = String::with_capacity(files.iter().map(|f| f.content.len() + 100).sum());
    
    // Add header if requested
    if options.include_header {
        output.push_str("# Project Files\n\n");
        output.push_str(&format!("Generated on {}\n", js_sys::Date::new_0().to_iso_string()));
        output.push_str(&format!("Total files: {}\n\n", files.len()));
    }

    // Add table of contents if requested
    if options.include_toc && files.len() > 1 {
        output.push_str("## Table of Contents\n\n");
        for (i, file) in files.iter().enumerate() {
            output.push_str(&format!("{}. [{}](#{})\n", 
                i + 1, 
                file.path,
                file.path.to_lowercase().replace(['/', '\\', ' ', '.'], "-")
            ));
        }
        output.push_str("\n");
    }

    // Process each file
    for (i, file) in files.iter().enumerate() {
        if i > 0 {
            output.push_str("\n\n");
        }

        // Determine language for syntax highlighting
        let language = detect_language(&file.path);
        
        if options.include_path_headers {
            output.push_str(&format!("#### File: `{}`\n\n", file.path));
        }

        // Add file stats if requested
        if options.include_stats {
            let lines = file.content.lines().count();
            let chars = file.content.chars().count();
            output.push_str(&format!("*Lines: {}, Characters: {}*\n\n", lines, chars));
        }

        // Add the code block
        output.push_str(&format!("```{}\n", language));
        output.push_str(file.content.trim());
        output.push_str("\n```");
    }

    Ok(output)
}

// Helper functions and types

#[derive(Serialize, Deserialize, Debug)]
pub struct ProcessingOptions {
    pub text_only: bool,
    pub hide_empty_folders: bool,
    pub show_token_count: bool,
}

impl Default for ProcessingOptions {
    fn default() -> Self {
        Self {
            text_only: true,
            hide_empty_folders: true,
            show_token_count: true,
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct MarkdownOptions {
    pub include_header: bool,
    pub include_toc: bool,
    pub include_path_headers: bool,
    pub include_stats: bool,
}

impl Default for MarkdownOptions {
    fn default() -> Self {
        Self {
            include_header: false,
            include_toc: false,
            include_path_headers: true,
            include_stats: false,
        }
    }
}

fn detect_language(path: &str) -> &'static str {
    if let Some(ext) = Path::new(path).extension().and_then(|s| s.to_str()) {
        match ext.to_lowercase().as_str() {
            "js" | "mjs" | "cjs" => "javascript",
            "ts" | "mts" | "cts" => "typescript",
            "tsx" => "tsx",
            "jsx" => "jsx",
            "py" | "pyi" => "python",
            "rs" => "rust",
            "go" => "go",
            "java" => "java",
            "c" => "c",
            "cpp" | "cc" | "cxx" => "cpp",
            "h" | "hpp" | "hxx" => "cpp",
            "cs" => "csharp",
            "php" => "php",
            "rb" => "ruby",
            "swift" => "swift",
            "kt" | "kts" => "kotlin",
            "scala" | "sc" => "scala",
            "hs" | "lhs" => "haskell",
            "ml" | "mli" => "ocaml",
            "fs" | "fsi" | "fsx" => "fsharp",
            "clj" | "cljs" | "cljc" => "clojure",
            "ex" | "exs" => "elixir",
            "erl" | "hrl" => "erlang",
            "html" | "htm" => "html",
            "css" => "css",
            "scss" => "scss",
            "sass" => "sass",
            "less" => "less",
            "json" => "json",
            "xml" => "xml",
            "yaml" | "yml" => "yaml",
            "toml" => "toml",
            "ini" => "ini",
            "sh" | "bash" => "bash",
            "ps1" => "powershell",
            "sql" => "sql",
            "md" | "mdx" => "markdown",
            "tex" => "latex",
            "r" => "r",
            "m" => "matlab",
            "dockerfile" => "dockerfile",
            "makefile" => "makefile",
            _ => "",
        }
    } else {
        // Handle files without extensions
        let filename = Path::new(path)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();
            
        match filename.as_str() {
            "dockerfile" => "dockerfile",
            "makefile" => "makefile",
            "gemfile" | "rakefile" => "ruby",
            "procfile" => "text",
            _ => "",
        }
    }
}

use std::collections::HashMap;
use std::sync::OnceLock;
use wasm_bindgen::prelude::*;
use ignore::gitignore::GitignoreBuilder;
use serde::{Deserialize, Serialize};
use tiktoken_rs::{cl100k_base, CoreBPE};
use crate::utils::{extract_file_name, normalize_path, set_panic_hook};

mod utils;

// Use a thread-safe, one-time initialization for the BPE encoder.
static TIKTOKEN_ENCODER: OnceLock<CoreBPE> = OnceLock::new();
fn get_encoder() -> &'static CoreBPE {
    TIKTOKEN_ENCODER.get_or_init(|| cl100k_base().expect("Failed to initialize tiktoken encoder"))
}

// --- Data Structures ---

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
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ProcessingResult {
    pub file_tree: Vec<FileNode>,
    pub total_tokens: u32,
    pub total_files: u32,
    pub total_size: u64,
    pub processing_time_ms: f64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct FilterResult {
    pub paths: Vec<String>,
    #[serde(rename = "processingTimeMs")]
    pub processing_time_ms: f64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct FileMetadata {
    pub path: String,
    pub size: u32,
}

#[derive(Serialize, Deserialize, Debug, Default)]
pub struct FilterOptions {
    #[serde(default = "default_true")]
    pub text_only: bool,
    #[serde(default = "default_max_file_size")]
    pub max_file_size: u32,
}
fn default_true() -> bool { true }
fn default_max_file_size() -> u32 { 2 * 1024 * 1024 } // 2MB

#[derive(Serialize, Deserialize, Debug, Default)]
pub struct ProcessingOptions {
    #[serde(default = "default_true")]
    pub hide_empty_folders: bool,
    #[serde(default = "default_true")]
    pub show_token_count: bool,
}

#[derive(Serialize, Deserialize, Debug, Default)]
pub struct MarkdownOptions {
    #[serde(default = "default_true")]
    pub include_path_headers: bool,
}

// --- Filtering Logic ---

static TEXT_EXTENSIONS: &[&str] = &[
    "js", "ts", "tsx", "jsx", "json", "md", "mdx", "html", "css", "scss", "sass", "less", "styl", "postcss",
    "py", "pyi", "rb", "php", "sh", "bash", "zsh", "ps1", "bat", "cmd", "rs", "go", "java", "c", "cpp", "h", "hpp", "cs",
    "txt", "yml", "yaml", "xml", "toml", "ini", "cfg", "conf", "config", "env", "mod", "sum", "lock",
    "dockerfile", "gitignore", "gitattributes", "editorconfig", "prettierrc", "eslintrc",
    "sql", "graphql", "gql", "vue", "svelte", "astro", "mjs", "cjs", "mts", "cts"
];

static SPECIAL_FILENAMES: &[&str] = &["dockerfile", "makefile", "license", "readme"];

fn is_likely_text_file(path: &str) -> bool {
    // Check extension
    if let Some(extension) = path.rsplit('.').next() {
        if TEXT_EXTENSIONS.contains(&extension.to_lowercase().as_str()) {
            return true;
        }
    }
    
    // Check special filenames without extensions
    if let Some(filename) = path.rsplit('/').next() {
        return SPECIAL_FILENAMES.contains(&filename.to_lowercase().as_str());
    }
    
    false
}

#[wasm_bindgen]
pub fn filter_files(
    metadata_js: JsValue,
    gitignore_content: String,
    _root_prefix: String, // Keep for API compatibility but don't use
    options_js: JsValue,
) -> Result<JsValue, JsValue> {
    set_panic_hook();
    let start_time = js_sys::Date::now();

    let metadata: Vec<FileMetadata> = serde_wasm_bindgen::from_value(metadata_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse metadata: {}", e)))?;
    let options: FilterOptions = serde_wasm_bindgen::from_value(options_js).unwrap_or_default();

    // Build gitignore patterns from .gitignore content, skipping blank lines and comments
    let mut gitignore_builder = GitignoreBuilder::new(".");
    for (idx, raw_line) in gitignore_content.lines().enumerate() {
        let line = raw_line.trim();
        // Skip empty and comment lines
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Err(e) = gitignore_builder.add_line(None, line) {
            web_sys::console::warn_1(&format!("Invalid gitignore pattern on line {}: {}", idx + 1, e).into());
        }
    }
    let gitignore = gitignore_builder
        .build()
        .map_err(|e| JsValue::from_str(&format!("Failed to build gitignore: {}", e)))?;

    let kept_paths: Vec<String> = metadata
        .into_iter()
        .filter_map(|meta| {
            // Browser-provided paths for files don't have a trailing slash.
            // We assume anything without a slash is a file. We don't get directory entries from the browser.
            let is_dir = meta.path.ends_with('/');
            
            // Strip the root folder name to get paths relative to the project root,
            // which is where the .gitignore rules apply.
            // e.g., "my-project/src/main.js" -> "src/main.js"
            let relative_path = if let Some(first_slash) = meta.path.find('/') {
                &meta.path[first_slash + 1..]
            } else {
                &meta.path
            };
            
            // If the relative path is empty (e.g. it was just the root folder), we can't process it.
            if relative_path.is_empty() {
                return None;
            }
            
            // Apply gitignore rules.
            // **FIX**: Use `matched_path_or_any_parents` because we are checking individual flat
            // paths, not walking a directory tree. This ensures that a rule like "var/"
            // correctly ignores a file like "var/pakaya.txt" by checking its parent components.
            if gitignore.matched_path_or_any_parents(relative_path, is_dir).is_ignore() {
                return None;
            }

            // If it's a directory, it passed the gitignore check, so keep it.
            if is_dir {
                return Some(meta.path);
            }
            
            // Check file size limit
            if meta.size > options.max_file_size {
                return None;
            }

            // If text_only, check if it's a text file based on extension/name
            if options.text_only && !is_likely_text_file(relative_path) {
                return None;
            }
            
            // If all checks pass, keep the original full path to be read later.
            Some(meta.path)
        })
        .collect();
    
    let processing_time = js_sys::Date::now() - start_time;
    let result = FilterResult {
        paths: kept_paths,
        processing_time_ms: processing_time,
    };

    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))
}


// --- Tree Processing Logic ---

#[wasm_bindgen]
pub fn process_files(files_js: JsValue, options_js: JsValue) -> Result<JsValue, JsValue> {
    set_panic_hook();
    let start_time = js_sys::Date::now();

    let files: Vec<FileInput> = serde_wasm_bindgen::from_value(files_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse files: {}", e)))?;
    let options: ProcessingOptions = serde_wasm_bindgen::from_value(options_js).unwrap_or_default();

    let mut nodes: HashMap<String, FileNode> = HashMap::new();
    let mut total_size = 0;
    let mut total_tokens = 0;

    for file in &files {
        let path = normalize_path(&file.path);
        let size = file.content.len() as u64;
        total_size += size;

        let tokens = if options.show_token_count {
            get_encoder().encode_with_special_tokens(&file.content).len() as u32
        } else {
            0
        };
        total_tokens += tokens;

        // Insert the file node
        nodes.insert(path.clone(), FileNode {
            path: path.clone(),
            name: extract_file_name(&path),
            is_dir: false,
            token_count: if options.show_token_count { Some(tokens) } else { None },
            children: vec![],
            size: Some(size),
        });

        // Ensure all parent directories exist
        let mut parent_path = std::path::Path::new(&path).parent();
        while let Some(p) = parent_path {
            if p.to_str().unwrap_or("").is_empty() { break; }
            let parent_path_str = normalize_path(p.to_str().unwrap());
            
            nodes.entry(parent_path_str.clone()).or_insert_with(|| FileNode {
                path: parent_path_str.clone(),
                name: extract_file_name(&parent_path_str),
                is_dir: true,
                token_count: if options.show_token_count { Some(0) } else { None },
                children: vec![],
                size: Some(0),
            });
            parent_path = p.parent();
        }
    }

    // Assemble the tree structure
    let mut root_nodes: Vec<FileNode> = Vec::new();
    let mut node_keys: Vec<String> = nodes.keys().cloned().collect();
    node_keys.sort_by(|a, b| b.len().cmp(&a.len())); // Process deeper paths first

    for key in &node_keys {
        if let Some(node) = nodes.remove(key) {
            let parent_path_opt = std::path::Path::new(key).parent()
                .and_then(|p| p.to_str())
                .map(normalize_path);

            if let Some(parent_path) = parent_path_opt {
                 if !parent_path.is_empty() {
                    if let Some(parent_node) = nodes.get_mut(&parent_path) {
                        if options.show_token_count {
                            parent_node.token_count = parent_node.token_count.zip(node.token_count).map(|(a,b)| a+b);
                        }
                        parent_node.size = parent_node.size.zip(node.size).map(|(a,b)| a+b);
                        parent_node.children.push(node);
                        continue;
                    }
                 }
            }
            root_nodes.push(node);
        }
    }
    
    // Sort and optionally hide empty folders
    fn finalise_tree(nodes: &mut Vec<FileNode>, options: &ProcessingOptions) {
        if options.hide_empty_folders {
            nodes.retain(|node| !node.is_dir || !node.children.is_empty());
        }
        
        nodes.sort_by(|a, b| {
            if a.is_dir != b.is_dir {
                b.is_dir.cmp(&a.is_dir) // Directories first
            } else {
                a.name.to_lowercase().cmp(&b.name.to_lowercase())
            }
        });

        for node in nodes {
            if node.is_dir {
                finalise_tree(&mut node.children, options);
            }
        }
    }
    
    finalise_tree(&mut root_nodes, &options);

    let result = ProcessingResult {
        file_tree: root_nodes,
        total_tokens,
        total_files: files.len() as u32,
        total_size,
        processing_time_ms: js_sys::Date::now() - start_time,
    };

    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))
}


// --- Count Recalculation ---

/// Recursively traverses a node, calculating and updating its total size and token count
/// based on its children. Returns a tuple of (total_size, total_tokens).
fn recursively_update_counts(node: &mut FileNode, show_token_count: bool) -> (u64, Option<u32>) {
    // If it's a file, its counts are authoritative. Return them.
    if !node.is_dir {
        return (node.size.unwrap_or(0), node.token_count);
    }

    // If it's a directory, initialize counters.
    let mut total_size: u64 = 0;
    let mut total_tokens: Option<u32> = if show_token_count { Some(0) } else { None };

    // Recursively call on children and aggregate their counts.
    for child in &mut node.children {
        let (child_size, child_tokens) = recursively_update_counts(child, show_token_count);
        total_size += child_size;
        
        // Add child tokens to parent's total if tracking tokens.
        if let (Some(tokens), Some(child_t)) = (total_tokens.as_mut(), child_tokens) {
            *tokens += child_t;
        }
    }

    // Update the current node's counts with the aggregated values.
    node.size = Some(total_size);
    node.token_count = total_tokens;

    (total_size, total_tokens)
}

#[wasm_bindgen]
pub fn recalculate_counts(tree_js: JsValue, options_js: JsValue) -> Result<JsValue, JsValue> {
    set_panic_hook();
    
    // Deserialize the file tree and options from JavaScript.
    let mut tree: Vec<FileNode> = serde_wasm_bindgen::from_value(tree_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse file tree: {}", e)))?;
    let options: ProcessingOptions = serde_wasm_bindgen::from_value(options_js)
        .unwrap_or_else(|_| ProcessingOptions::default());

    // Iterate over root nodes and start the recursive update.
    for node in &mut tree {
        recursively_update_counts(node, options.show_token_count);
    }

    // Serialize the updated tree back to a JavaScript value.
    serde_wasm_bindgen::to_value(&tree)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))
}


// --- Markdown Generation ---

#[wasm_bindgen]
pub fn merge_files_to_markdown(files_js: JsValue, options_js: JsValue) -> Result<String, JsValue> {
    set_panic_hook();
    let files: Vec<FileInput> = serde_wasm_bindgen::from_value(files_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse files: {}", e)))?;
    let options: MarkdownOptions = serde_wasm_bindgen::from_value(options_js).unwrap_or_default();
    
    if files.is_empty() { return Ok(String::new()); }

    let mut output = String::new();
    for file in files {
        let language = detect_language(&file.path);
        if options.include_path_headers {
            output.push_str(&format!("#### File: `{}`\n", file.path));
        }
        output.push_str(&format!("```{}\n", language));
        output.push_str(file.content.trim());
        output.push_str("\n```\n\n");
    }
    Ok(output.trim().to_string())
}

fn detect_language(path: &str) -> &'static str {
    match path.rsplit('.').next().unwrap_or("") {
        "js" | "mjs" | "cjs" => "javascript",
        "ts" | "mts" | "cts" => "typescript",
        "tsx" => "tsx",
        "jsx" => "jsx",
        "py" => "python",
        "rs" => "rust",
        "go" => "go",
        "java" => "java",
        "c" => "c",
        "h" => "c",
        "cpp" | "cxx" | "cc" => "cpp",
        "hpp" | "hxx" => "cpp",
        "cs" => "csharp",
        "php" => "php",
        "rb" => "ruby",
        "swift" => "swift",
        "kt" | "kts" => "kotlin",
        "html" | "htm" => "html",
        "css" => "css",
        "scss" => "scss",
        "json" => "json",
        "xml" => "xml",
        "yaml" | "yml" => "yaml",
        "toml" => "toml",
        "sh" | "bash" | "zsh" => "bash",
        "sql" => "sql",
        "md" | "mdx" => "markdown",
        "dockerfile" => "dockerfile",
        _ => if path.to_lowercase().ends_with("makefile") { "makefile" } else { "" }
    }
}

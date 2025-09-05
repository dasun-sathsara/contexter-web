use crate::utils::{extract_file_name, normalize_path, set_panic_hook};
use ignore::gitignore::GitignoreBuilder;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::OnceLock;
use tiktoken_rs::{cl100k_base, CoreBPE};
use wasm_bindgen::prelude::*;

mod utils;

static TIKTOKEN_ENCODER: OnceLock<CoreBPE> = OnceLock::new();
fn get_encoder() -> &'static CoreBPE {
    TIKTOKEN_ENCODER.get_or_init(|| cl100k_base().expect("Failed to initialize tiktoken encoder"))
}

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
pub struct ProcessingOptions {
    #[serde(default = "default_true")]
    pub hide_empty_folders: bool,
    #[serde(default = "default_true")]
    pub show_token_count: bool,
}
fn default_true() -> bool {
    true
}

#[derive(Serialize, Deserialize, Debug, Default)]
pub struct MarkdownOptions {
    #[serde(default = "default_true")]
    pub include_path_headers: bool,
}

#[wasm_bindgen]
pub fn filter_files(metadata_js: JsValue, gitignore_content: String) -> Result<JsValue, JsValue> {
    set_panic_hook();
    let start_time = js_sys::Date::now();

    let metadata: Vec<FileMetadata> = serde_wasm_bindgen::from_value(metadata_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse metadata: {}", e)))?;

    let mut gitignore_builder = GitignoreBuilder::new(".");
    for (idx, raw_line) in gitignore_content.lines().enumerate() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Err(e) = gitignore_builder.add_line(None, line) {
            web_sys::console::warn_1(
                &format!("Invalid gitignore pattern on line {}: {}", idx + 1, e).into(),
            );
        }
    }
    let gitignore = gitignore_builder
        .build()
        .map_err(|e| JsValue::from_str(&format!("Failed to build gitignore: {}", e)))?;

    let kept_paths: Vec<String> = metadata
        .into_iter()
        .filter_map(|meta| {
            let is_dir = meta.path.ends_with('/');

            let relative_path = if let Some(first_slash) = meta.path.find('/') {
                &meta.path[first_slash + 1..]
            } else {
                &meta.path
            };

            // Filter out the .git directory and its contents
            if relative_path.starts_with(".git/") || relative_path == ".git" {
                return None;
            }

            if relative_path.is_empty() {
                return None;
            }

            if gitignore
                .matched_path_or_any_parents(relative_path, is_dir)
                .is_ignore()
            {
                return None;
            }

            if is_dir {
                return Some(meta.path);
            }

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
            get_encoder()
                .encode_with_special_tokens(&file.content)
                .len() as u32
        } else {
            0
        };
        total_tokens += tokens;

        nodes.insert(
            path.clone(),
            FileNode {
                path: path.clone(),
                name: extract_file_name(&path),
                is_dir: false,
                token_count: if options.show_token_count {
                    Some(tokens)
                } else {
                    None
                },
                children: vec![],
                size: Some(size),
            },
        );

        let mut parent_path = std::path::Path::new(&path).parent();
        while let Some(p) = parent_path {
            if p.to_str().unwrap_or("").is_empty() {
                break;
            }
            let parent_path_str = normalize_path(p.to_str().unwrap());

            nodes
                .entry(parent_path_str.clone())
                .or_insert_with(|| FileNode {
                    path: parent_path_str.clone(),
                    name: extract_file_name(&parent_path_str),
                    is_dir: true,
                    token_count: if options.show_token_count {
                        Some(0)
                    } else {
                        None
                    },
                    children: vec![],
                    size: Some(0),
                });
            parent_path = p.parent();
        }
    }

    let mut root_nodes: Vec<FileNode> = Vec::new();
    let mut node_keys: Vec<String> = nodes.keys().cloned().collect();
    node_keys.sort_by(|a, b| b.len().cmp(&a.len()));

    for key in &node_keys {
        if let Some(node) = nodes.remove(key) {
            let parent_path_opt = std::path::Path::new(key)
                .parent()
                .and_then(|p| p.to_str())
                .map(normalize_path);

            if let Some(parent_path) = parent_path_opt {
                if !parent_path.is_empty() {
                    if let Some(parent_node) = nodes.get_mut(&parent_path) {
                        if options.show_token_count {
                            parent_node.token_count = parent_node
                                .token_count
                                .zip(node.token_count)
                                .map(|(a, b)| a + b);
                        }
                        parent_node.size = parent_node.size.zip(node.size).map(|(a, b)| a + b);
                        parent_node.children.push(node);
                        continue;
                    }
                }
            }
            root_nodes.push(node);
        }
    }

    fn finalise_tree(nodes: &mut Vec<FileNode>, options: &ProcessingOptions) {
        if options.hide_empty_folders {
            nodes.retain(|node| !node.is_dir || !node.children.is_empty());
        }

        nodes.sort_by(|a, b| {
            if a.is_dir != b.is_dir {
                b.is_dir.cmp(&a.is_dir)
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

/// Recursively updates counts for a node based on its children.
fn recursively_update_counts(node: &mut FileNode, show_token_count: bool) -> (u64, Option<u32>) {
    if !node.is_dir {
        return (node.size.unwrap_or(0), node.token_count);
    }

    let mut total_size: u64 = 0;
    let mut total_tokens: Option<u32> = if show_token_count { Some(0) } else { None };

    for child in &mut node.children {
        let (child_size, child_tokens) = recursively_update_counts(child, show_token_count);
        total_size += child_size;

        if let (Some(tokens), Some(child_t)) = (total_tokens.as_mut(), child_tokens) {
            *tokens += child_t;
        }
    }

    node.size = Some(total_size);
    node.token_count = total_tokens;

    (total_size, total_tokens)
}

#[wasm_bindgen]
pub fn recalculate_counts(tree_js: JsValue, options_js: JsValue) -> Result<JsValue, JsValue> {
    set_panic_hook();

    let mut tree: Vec<FileNode> = serde_wasm_bindgen::from_value(tree_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse file tree: {}", e)))?;
    let options: ProcessingOptions =
        serde_wasm_bindgen::from_value(options_js).unwrap_or_else(|_| ProcessingOptions::default());

    for node in &mut tree {
        recursively_update_counts(node, options.show_token_count);
    }

    serde_wasm_bindgen::to_value(&tree)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))
}

#[wasm_bindgen]
pub fn merge_files_to_markdown(files_js: JsValue, options_js: JsValue) -> Result<String, JsValue> {
    set_panic_hook();
    let files: Vec<FileInput> = serde_wasm_bindgen::from_value(files_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse files: {}", e)))?;
    let options: MarkdownOptions = serde_wasm_bindgen::from_value(options_js).unwrap_or_default();

    if files.is_empty() {
        return Ok(String::new());
    }

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
        _ => {
            if path.to_lowercase().ends_with("makefile") {
                "makefile"
            } else {
                ""
            }
        }
    }
}

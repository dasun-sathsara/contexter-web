use std::collections::{HashMap, HashSet};
use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use tiktoken_rs::{cl100k_base, CoreBPE};
use ignore::gitignore;
use path_slash::PathExt;
use once_cell::sync::Lazy;
use std::path::Path;

static TIKTOKEN_ENCODER: Lazy<CoreBPE> = Lazy::new(|| cl100k_base().unwrap());

#[derive(Serialize, Deserialize)]
pub struct FileInput { pub path: String, pub content: String }

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileNode {
    pub path: String, pub name: String, pub is_dir: bool,
    #[serde(skip_serializing_if = "Option::is_none")] pub token_count: Option<u32>,
    #[serde(skip_serializing_if = "Vec::is_empty")] pub children: Vec<FileNode>,
}

#[derive(Serialize, Deserialize)]
pub struct ProcessingResult { pub file_tree: Vec<FileNode>, pub total_tokens: u32, pub total_files: u32 }

// NEW: Struct for receiving file metadata from JS
#[derive(Serialize, Deserialize)]
pub struct FileMetadata {
    pub path: String,
    pub size: u32, // JS file.size is a number, fits in u32 for files up to 4GB
}

fn is_likely_text_by_extension(path: &str) -> bool {
    let text_exts: HashSet<&str> = [
        "js", "ts", "tsx", "jsx", "json", "md", "mdx", "html", "css",
        "scss", "less", "py", "rs", "go", "java", "c", "cpp", "h", "hpp",
        "hs", "rb", "php", "sh", "txt", "yml", "yaml", "xml", "toml", "gitignore",
    ].iter().cloned().collect();

    if let Some(ext) = Path::new(path).extension().and_then(|s| s.to_str()) {
        return text_exts.contains(ext.to_lowercase().as_str());
    }
    // Assume it could be text if no extension (e.g., a file named 'LICENSE')
    true
}

fn get_file_name(path: &str) -> String { Path::new(path).file_name().unwrap_or_default().to_string_lossy().to_string() }

// RENAMED and REWRITTEN: This function now does ALL filtering.
#[wasm_bindgen]
pub fn filter_files(
    metadata_js: JsValue,
    gitignore_content: String,
    root_prefix: String,
    text_only: bool,
) -> Result<JsValue, JsValue> {
    console_error_panic_hook::set_once();
    let metadata: Vec<FileMetadata> = serde_wasm_bindgen::from_value(metadata_js)?;

    let mut builder = gitignore::GitignoreBuilder::new("/");
    if !gitignore_content.is_empty() {
        for line in gitignore_content.lines() {
            let _ = builder.add_line(None, line);
        }
    }
    let matcher = builder.build().map_err(|e| e.to_string())?;

    const MAX_FILE_SIZE: u32 = 2 * 1024 * 1024; // 2MB

    let kept_paths: Vec<String> = metadata
        .into_iter()
        .filter(|meta| {
            // .gitignore check
            let relative_path_str = if !root_prefix.is_empty() && meta.path.starts_with(&root_prefix) {
                &meta.path[root_prefix.len()..]
            } else {
                meta.path.as_str()
            };
            if matcher.matched(Path::new(relative_path_str), false).is_ignore() {
                return false;
            }

            // Size check
            if meta.size > MAX_FILE_SIZE {
                return false;
            }

            // Text-only check (by extension)
            if text_only && !is_likely_text_by_extension(&meta.path) {
                return false;
            }

            true
        })
        .map(|meta| meta.path)
        .collect();

    Ok(serde_wasm_bindgen::to_value(&kept_paths)?)
}

#[wasm_bindgen]
pub fn process_files(
    files_js: JsValue,
    text_only: bool,
    hide_empty_folders: bool,
    show_token_count: bool,
) -> Result<JsValue, JsValue> {
    console_error_panic_hook::set_once();
    let files: Vec<FileInput> = serde_wasm_bindgen::from_value(files_js)?;
    let mut node_map: HashMap<String, FileNode> = HashMap::new();
    
    // The `is_likely_text` check is now a fallback, as most non-text files should be pre-filtered.
    let filtered_files: Vec<&FileInput> = files.iter().filter(|file| !text_only || !file.content.as_bytes().contains(&0)).collect();

    for file in &filtered_files {
        let token_count_opt = if show_token_count {
            Some(TIKTOKEN_ENCODER.encode_with_special_tokens(&file.content).len() as u32)
        } else {
            None
        };
        node_map.insert(file.path.clone(), FileNode {
            path: file.path.clone(), name: get_file_name(&file.path), is_dir: false,
            token_count: token_count_opt, children: vec![],
        });
        let mut current_path = Path::new(&file.path);
        while let Some(parent_path) = current_path.parent() {
            let parent_str = parent_path.to_slash_lossy().into_owned();
            if parent_str.is_empty() { break; }
            node_map.entry(parent_str.clone()).or_insert_with(|| FileNode {
                path: parent_str, name: get_file_name(&parent_path.to_string_lossy()),
                is_dir: true, token_count: None, children: vec![],
            });
            current_path = parent_path;
        }
    }

    let paths: Vec<String> = node_map.keys().cloned().collect();
    for path_str in paths {
        if let Some(parent_path) = Path::new(&path_str).parent().and_then(|p| p.to_str()) {
            if !parent_path.is_empty() {
                if let Some(child_node) = node_map.remove(&path_str) {
                    if let Some(parent_node) = node_map.get_mut(parent_path) {
                        parent_node.children.push(child_node);
                    }
                }
            }
        }
    }
    let mut root_nodes = node_map.into_values().collect();

    fn post_process(nodes: &mut Vec<FileNode>, hide_empty: bool) -> u32 {
        let mut total_tokens = 0;
        nodes.retain_mut(|node| {
            if node.is_dir {
                let child_tokens = post_process(&mut node.children, hide_empty);
                node.token_count = Some(child_tokens);
                total_tokens += child_tokens;
                !hide_empty || !node.children.is_empty()
            } else {
                total_tokens += node.token_count.unwrap_or(0);
                true
            }
        });
        total_tokens
    }
    let total_tokens = post_process(&mut root_nodes, hide_empty_folders);

    fn sort_nodes(nodes: &mut Vec<FileNode>) {
        nodes.sort_by(|a, b| {
            if a.is_dir != b.is_dir { b.is_dir.cmp(&a.is_dir) } else { a.name.cmp(&b.name) }
        });
        for node in nodes { if node.is_dir { sort_nodes(&mut node.children); } }
    }
    sort_nodes(&mut root_nodes);

    let result = ProcessingResult { file_tree: root_nodes, total_tokens, total_files: filtered_files.len() as u32 };
    Ok(serde_wasm_bindgen::to_value(&result)?)
}

#[wasm_bindgen]
pub fn merge_files_to_markdown(files_js: JsValue) -> Result<String, JsValue> {
    let files: Vec<FileInput> = serde_wasm_bindgen::from_value(files_js)?;
    let mut output = String::new();
    for (i, file) in files.iter().enumerate() {
        if i > 0 { output.push_str("\n\n"); }
        output.push_str(&format!("#### {}\n\n", file.path));
        output.push_str("```\n");
        output.push_str(file.content.trim());
        output.push_str("\n```");
    }
    Ok(output)
}

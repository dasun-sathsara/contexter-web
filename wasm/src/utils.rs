use path_slash::PathExt;
use std::path::Path;
use wasm_bindgen::prelude::*;

/// Sets up a panic hook to forward Rust panics to the browser's console.
pub fn set_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Normalizes a path string by converting backslashes to forward slashes.
pub fn normalize_path(path: &str) -> String {
    Path::new(path).to_slash_lossy().to_string()
}

/// Extracts the final component (file or directory name) from a path string.
pub fn extract_file_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|name| name.to_str())
        .map(String::from)
        .unwrap_or_else(|| path.to_string())
}

/// Logs a message to the browser's developer console.
#[wasm_bindgen]
#[allow(dead_code)]
pub fn log_message(level: &str, message: &str) {
    match level {
        "error" => web_sys::console::error_1(&message.into()),
        "warn" => web_sys::console::warn_1(&message.into()),
        "info" => web_sys::console::info_1(&message.into()),
        "debug" => web_sys::console::debug_1(&message.into()),
        _ => web_sys::console::log_1(&message.into()),
    }
}

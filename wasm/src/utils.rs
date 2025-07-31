//! Utility functions for the Contexter WASM module.
//!
//! This module provides common helpers for error handling, path manipulation,
//! and text content validation, ensuring consistent and reliable operations
//! throughout the library.

use wasm_bindgen::prelude::*;
use path_slash::PathExt;
use std::path::Path;

/// Sets up a panic hook to forward Rust panics to the browser's console.
/// This is crucial for debugging, as it provides a clear stack trace.
pub fn set_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Normalizes a path string by converting backslashes to forward slashes.
/// This ensures consistent path representation across different platforms.
///
/// # Example
/// `C:\\Users\\Test` becomes `C:/Users/Test`
pub fn normalize_path(path: &str) -> String {
    Path::new(path).to_slash_lossy().to_string()
}

/// Extracts the final component (file or directory name) from a path string.
/// Returns "unknown" if the path is empty or invalid.
///
/// # Example
/// `src/components/Button.tsx` becomes `Button.tsx`
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_path() {
        assert_eq!(normalize_path("path\\with\\backslashes"), "path/with/backslashes");
        assert_eq!(normalize_path("path/with/forward/slashes"), "path/with/forward/slashes");
        assert_eq!(normalize_path(""), "");
    }

    #[test]
    fn test_extract_file_name() {
        assert_eq!(extract_file_name("src/components/Button.tsx"), "Button.tsx");
        assert_eq!(extract_file_name("src/components/"), "components");
        assert_eq!(extract_file_name("file.txt"), "file.txt");
        assert_eq!(extract_file_name("/"), "/");
    }
}

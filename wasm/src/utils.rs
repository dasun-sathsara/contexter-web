//! Utility functions for WASM module
//! 
//! This module provides common utility functions used across the WASM module,
//! including error handling, debugging helpers, and performance utilities.

use wasm_bindgen::prelude::*;
use web_sys::console;

/// Sets up panic hooks for better error reporting in WASM
/// 
/// This function should be called once during initialization to ensure
/// that panics in Rust code are properly reported to the browser console
/// with useful stack traces and error messages.
pub fn set_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Performance timer for measuring execution time
pub struct Timer {
    start_time: f64,
    label: String,
}

impl Timer {
    /// Create a new timer with a label
    pub fn new(label: &str) -> Self {
        Self {
            start_time: js_sys::Date::now(),
            label: label.to_string(),
        }
    }

    /// Get elapsed time in milliseconds
    pub fn elapsed(&self) -> f64 {
        js_sys::Date::now() - self.start_time
    }

    /// Log elapsed time to console
    pub fn log_elapsed(&self) {
        let elapsed = self.elapsed();
        console::log_1(&format!("[{}] Elapsed: {:.2}ms", self.label, elapsed).into());
    }
}

impl Drop for Timer {
    fn drop(&mut self) {
        self.log_elapsed();
    }
}

/// Log a message to the browser console with a specific level
#[wasm_bindgen]
pub fn log_message(level: &str, message: &str) {
    match level {
        "error" => console::error_1(&message.into()),
        "warn" => console::warn_1(&message.into()),
        "info" => console::info_1(&message.into()),
        "debug" => console::debug_1(&message.into()),
        _ => console::log_1(&message.into()),
    }
}

/// Memory usage reporter for debugging
#[wasm_bindgen]
pub fn report_memory_usage() -> JsValue {
    let memory = wasm_bindgen::memory();
    let buffer = memory.buffer();
    let byte_length = buffer.byte_length();
    
    let report = serde_json::json!({
        "memoryBytes": byte_length,
        "memoryKB": byte_length as f64 / 1024.0,
        "memoryMB": byte_length as f64 / (1024.0 * 1024.0)
    });
    
    serde_wasm_bindgen::to_value(&report).unwrap_or(JsValue::NULL)
}

/// Validate and sanitize file paths
pub fn sanitize_path(path: &str) -> String {
    // Remove any null bytes and control characters
    let sanitized: String = path.chars()
        .filter(|c| !c.is_control() || c.is_whitespace())
        .collect();
    
    // Normalize path separators to forward slashes
    sanitized.replace('\\', "/")
}

/// Check if a string contains valid UTF-8 and no null bytes
pub fn is_valid_text_content(content: &str) -> bool {
    // Check for null bytes (common in binary files)
    if content.as_bytes().contains(&0) {
        return false;
    }
    
    // Check for high ratio of control characters (excluding whitespace)
    let control_chars = content.chars()
        .filter(|c| c.is_control() && !c.is_whitespace())
        .count();
    
    let total_chars = content.chars().count();
    
    if total_chars == 0 {
        return true; // Empty files are valid
    }
    
    // If more than 10% of characters are control characters, likely binary
    (control_chars as f32 / total_chars as f32) <= 0.1
}

/// Estimate the complexity of text content for processing hints
pub fn estimate_content_complexity(content: &str) -> u32 {
    let lines = content.lines().count();
    let chars = content.chars().count();
    let words = content.split_whitespace().count();
    
    // Simple heuristic: more lines and words = higher complexity
    ((lines * 2) + (words / 10) + (chars / 1000)) as u32
}

/// Format file size in human-readable format
pub fn format_file_size(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_index = 0;
    
    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }
    
    if unit_index == 0 {
        format!("{} {}", bytes, UNITS[unit_index])
    } else {
        format!("{:.1} {}", size, UNITS[unit_index])
    }
}

/// Debounce utility for rate-limiting expensive operations
pub struct Debouncer {
    last_call: f64,
    delay_ms: f64,
}

impl Debouncer {
    pub fn new(delay_ms: f64) -> Self {
        Self {
            last_call: 0.0,
            delay_ms,
        }
    }
    
    pub fn should_execute(&mut self) -> bool {
        let now = js_sys::Date::now();
        let elapsed = now - self.last_call;
        
        if elapsed >= self.delay_ms {
            self.last_call = now;
            true
        } else {
            false
        }
    }
    
    pub fn reset(&mut self) {
        self.last_call = 0.0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_path() {
        assert_eq!(sanitize_path("path\\with\\backslashes"), "path/with/backslashes");
        assert_eq!(sanitize_path("path/with/forward/slashes"), "path/with/forward/slashes");
        assert_eq!(sanitize_path("normal_file.txt"), "normal_file.txt");
    }

    #[test]
    fn test_is_valid_text_content() {
        assert!(is_valid_text_content("Hello, world!"));
        assert!(is_valid_text_content(""));
        assert!(is_valid_text_content("Line 1\nLine 2\nLine 3"));
        assert!(!is_valid_text_content("Hello\0world")); // Contains null byte
    }

    #[test]
    fn test_format_file_size() {
        assert_eq!(format_file_size(0), "0 B");
        assert_eq!(format_file_size(512), "512 B");
        assert_eq!(format_file_size(1024), "1.0 KB");
        assert_eq!(format_file_size(1536), "1.5 KB");
        assert_eq!(format_file_size(1048576), "1.0 MB");
    }

    #[test]
    fn test_estimate_content_complexity() {
        let simple_content = "Hello world";
        let complex_content = "Line 1\nLine 2\nLine 3\nThis is a more complex file with many words and multiple lines.";
        
        assert!(estimate_content_complexity(complex_content) > estimate_content_complexity(simple_content));
    }
}

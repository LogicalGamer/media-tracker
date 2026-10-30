// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    nvidia_workaround();

    media_tracker_lib::run()
}

/// WebKitGTK (the engine that draws the window on Linux) stutters or shows a
/// blank window with NVIDIA's driver. Turning off its DMA-BUF renderer fixes it.
/// The file below only exists when the NVIDIA driver is loaded. If the user set
/// the variable themselves, we leave their choice alone.
#[cfg(target_os = "linux")]
fn nvidia_workaround() {
    let has_nvidia = std::path::Path::new("/proc/driver/nvidia/version").exists();
    if has_nvidia && std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        // SAFETY: runs first thing in main, before any other threads exist.
        unsafe { std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1") };
    }
}

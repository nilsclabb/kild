//! kild-tauri: Cross-platform GUI for KILD
//!
//! Tauri v2 application with a React frontend and Rust backend
//! that wraps kild-core for session management.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;

mod commands;
mod pty;

use pty::PtyManager;

fn main() {
    let pty_manager = Arc::new(PtyManager::new());

    tauri::Builder::default()
        .manage(pty_manager)
        .setup(|app| {
            use tauri::Manager;
            // Set window icon from icons/icon.png
            if let Some(window) = app.get_webview_window("main") {
                let icon_bytes = include_bytes!("../icons/icon.png");
                let icon = tauri::image::Image::from_bytes(icon_bytes)?;
                window.set_icon(icon)?;

                // Apply macOS vibrancy
                #[cfg(target_os = "macos")]
                {
                    use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
                    let _ = apply_vibrancy(
                        &window,
                        NSVisualEffectMaterial::UnderWindowBackground,
                        None,
                        None,
                    );
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_sessions,
            commands::get_session,
            commands::stop_session,
            commands::destroy_session,
            commands::create_session,
            commands::get_agent_command,
            commands::spawn_pty,
            commands::write_pty,
            commands::resize_pty,
            commands::close_pty,
        ])
        .run(tauri::generate_context!())
        .expect("error while running KILD Tauri application");
}

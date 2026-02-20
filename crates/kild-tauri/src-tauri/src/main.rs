//! kild-tauri: Cross-platform GUI for KILD
//!
//! Tauri v2 application with a React frontend and Rust backend
//! that wraps kild-core for session management.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::list_sessions,
            commands::get_session,
            commands::stop_session,
            commands::destroy_session,
            commands::create_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running KILD Tauri application");
}

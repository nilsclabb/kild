//! Tauri command handlers wrapping kild-core APIs and PTY management.
//!
//! Each function is exposed to the React frontend via `invoke()`.

use crate::pty::PtyManager;
use kild_core::sessions::types::SessionStatus;
use serde::Serialize;
use std::path::Path;
use std::sync::Arc;
use tauri::{Emitter, State, Window};

/// Simplified session data for the frontend.
#[derive(Debug, Clone, Serialize)]
pub struct SessionInfo {
    pub branch: String,
    pub agent: String,
    pub status: String,
    pub worktree_path: String,
    pub created_at: String,
    pub session_id: String,
    pub git_dirty: bool,
    pub runtime_mode: String,
}

impl SessionInfo {
    fn from_session(s: &kild_core::Session) -> Self {
        let status = match s.status {
            SessionStatus::Active => "running",
            SessionStatus::Stopped => "stopped",
            SessionStatus::Destroyed => "destroyed",
        };

        let runtime_mode = s
            .runtime_mode
            .as_ref()
            .map(|m| format!("{:?}", m).to_lowercase())
            .unwrap_or_else(|| "terminal".to_string());

        let git_dirty = check_git_dirty(&s.worktree_path);

        Self {
            branch: s.branch.to_string(),
            agent: s.agent.clone(),
            status: status.to_string(),
            worktree_path: s.worktree_path.display().to_string(),
            created_at: s.created_at.clone(),
            session_id: s.id.to_string(),
            git_dirty,
            runtime_mode,
        }
    }
}

fn check_git_dirty(worktree_path: &Path) -> bool {
    let Ok(repo) = git2::Repository::open(worktree_path) else {
        return false;
    };
    let Ok(statuses) = repo.statuses(None) else {
        return false;
    };
    !statuses.is_empty()
}

// =============================================================================
// Session commands
// =============================================================================

#[tauri::command]
pub fn list_sessions() -> Result<Vec<SessionInfo>, String> {
    let sessions = kild_core::session_ops::list_sessions().map_err(|e| e.to_string())?;
    Ok(sessions.iter().map(SessionInfo::from_session).collect())
}

#[tauri::command]
pub fn get_session(branch: String) -> Result<Option<SessionInfo>, String> {
    let sessions = kild_core::session_ops::list_sessions().map_err(|e| e.to_string())?;
    let found = sessions
        .iter()
        .find(|s| s.branch.as_ref() == branch)
        .map(SessionInfo::from_session);
    Ok(found)
}

#[tauri::command]
pub fn stop_session(branch: String) -> Result<(), String> {
    kild_core::session_ops::stop_session(&branch).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn destroy_session(branch: String, force: bool) -> Result<(), String> {
    kild_core::session_ops::destroy_session(&branch, force).map_err(|e| e.to_string())
}

/// Create a kild session: creates the worktree + session file WITHOUT
/// spawning the agent in an external terminal. The agent is spawned later
/// in the embedded PTY via `spawn_pty`.
#[tauri::command]
pub fn create_session(branch: String, agent: String) -> Result<SessionInfo, String> {
    use kild_config::Config;
    use kild_core::sessions::{persistence, ports};

    let config = Config::new();
    let kild_config = kild_config::KildConfig::load_hierarchy().map_err(|e: Box<dyn std::error::Error>| e.to_string())?;

    // 1. Resolve agent command
    let _agent_command = kild_config
        .get_agent_command(&agent)
        .map_err(|e| format!("Unknown agent '{}': {}", agent, e))?;

    // 2. Detect git project
    let project =
        kild_core::git::handler::detect_project().map_err(|e| format!("Git error: {}", e))?;

    let project_id: kild_protocol::ProjectId = project.id.clone().into();
    let branch_name: kild_protocol::BranchName = branch.clone().into();
    let session_id = ports::generate_session_id(&project_id, &branch_name);

    // 3. Ensure sessions directory
    persistence::ensure_sessions_directory(&config.sessions_dir())
        .map_err(|e| format!("Sessions dir error: {}", e))?;

    // 4. Allocate port range
    let (port_start, port_end) = ports::allocate_port_range(
        &config.sessions_dir(),
        config.default_port_count,
        config.base_port_range,
    )
    .map_err(|e| format!("Port allocation error: {}", e))?;

    // 5. Create worktree (I/O)
    let git_config = kild_config.git.clone();
    let worktree = kild_core::git::handler::create_worktree(
        config.kild_dir(),
        &project,
        &branch_name,
        Some(&kild_config),
        &git_config,
    )
    .map_err(|e| format!("Worktree creation error: {}", e))?;

    // 6. Create session record — status Active, no agent process yet
    let now = chrono::Utc::now().to_rfc3339();
    let session = kild_core::Session::new(
        session_id.clone(),
        project_id,
        branch_name.clone(),
        worktree.path.clone(),
        agent.clone(),
        SessionStatus::Active,
        now.clone(),
        port_start,
        port_end,
        config.default_port_count,
        Some(now),
        None,    // no note
        vec![],  // no agent processes — agent runs in embedded PTY
        None,    // no agent_session_id
        None,    // no task_list_id
        None,    // no runtime_mode (embedded)
    );

    // 7. Save session file
    persistence::save_session_to_file(&session, &config.sessions_dir())
        .map_err(|e| format!("Failed to save session: {}", e))?;

    Ok(SessionInfo::from_session(&session))
}

/// Get the agent command for a given agent name from kild config.
#[tauri::command]
pub fn get_agent_command(agent: String) -> Result<String, String> {
    let kild_config = kild_config::KildConfig::load_hierarchy().map_err(|e: Box<dyn std::error::Error>| e.to_string())?;
    kild_config
        .get_agent_command(&agent)
        .map_err(|e| format!("Unknown agent '{}': {}", agent, e))
}

// =============================================================================
// PTY commands — embedded terminal
// =============================================================================

/// PTY output event payload sent to the frontend.
#[derive(Clone, Serialize)]
struct PtyOutput {
    session_id: String,
    /// Base64-encoded bytes (terminal output can contain binary escape sequences)
    data: String,
}

/// Spawn a PTY and run a command. Output is streamed via "pty-output" events.
#[tauri::command]
pub fn spawn_pty(
    window: Window,
    pty_manager: State<'_, Arc<PtyManager>>,
    session_id: String,
    command: String,
    args: Vec<String>,
    cwd: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    pty_manager.spawn(
        &session_id,
        &command,
        &arg_refs,
        &cwd,
        cols,
        rows,
        move |sid, data| {
            if data.is_empty() {
                // EOF — process exited
                let _ = window.emit("pty-exit", sid.to_string());
            } else {
                // Encode as base64 for safe transport over JSON
                let encoded = base64_encode(data);
                let _ = window.emit(
                    "pty-output",
                    PtyOutput {
                        session_id: sid.to_string(),
                        data: encoded,
                    },
                );
            }
        },
    )
}

/// Write input data to a PTY session.
#[tauri::command]
pub fn write_pty(
    pty_manager: State<'_, Arc<PtyManager>>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    pty_manager.write(&session_id, data.as_bytes())
}

/// Resize a PTY session.
#[tauri::command]
pub fn resize_pty(
    pty_manager: State<'_, Arc<PtyManager>>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    pty_manager.resize(&session_id, cols, rows)
}

/// Close a PTY session.
#[tauri::command]
pub fn close_pty(
    pty_manager: State<'_, Arc<PtyManager>>,
    session_id: String,
) -> Result<(), String> {
    pty_manager.close(&session_id);
    Ok(())
}

/// Simple base64 encoder (avoids adding another dependency).
fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;
        result.push(CHARS[((triple >> 18) & 0x3F) as usize] as char);
        result.push(CHARS[((triple >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            result.push(CHARS[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(CHARS[(triple & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

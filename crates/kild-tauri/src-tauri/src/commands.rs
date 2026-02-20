//! Tauri command handlers wrapping kild-core APIs.
//!
//! Each function is exposed to the React frontend via `invoke()`.

use kild_core::sessions::types::SessionStatus;
use serde::Serialize;
use std::path::Path;

/// Simplified session data for the frontend.
///
/// We don't send the full `kild_core::Session` to avoid PathBuf serialization
/// issues and to keep the frontend types clean.
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

#[tauri::command]
pub fn create_session(branch: String, agent: String) -> Result<String, String> {
    // Shell out to the `kild` CLI which handles all complexity:
    // project detection, worktree creation, config resolution, terminal launching.
    let output = std::process::Command::new("kild")
        .args(["create", &branch, "--agent", &agent])
        .output()
        .map_err(|e| format!("Failed to run kild CLI: {}. Is kild installed?", e))?;

    if output.status.success() {
        Ok(format!("Created kild '{}' with agent '{}'", branch, agent))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let msg = if !stderr.is_empty() {
            stderr.to_string()
        } else {
            stdout.to_string()
        };
        Err(format!("Failed to create kild: {}", msg.trim()))
    }
}


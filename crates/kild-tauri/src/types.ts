/** Session info as returned from the Rust backend */
export interface SessionInfo {
    branch: string;
    agent: string;
    status: "running" | "stopped" | "destroyed" | "crashed";
    worktree_path: string;
    created_at: string;
    session_id: string;
    git_dirty: boolean;
    runtime_mode: "terminal" | "daemon";
}

/** Session info as returned from the Rust backend */
export interface SessionInfo {
    branch: string;
    agent: string;
    status: "running" | "stopped" | "destroyed" | "crashed";
    worktree_path: string;
    created_at: string;
    session_id: string;
    project_id: string;
    git_dirty: boolean;
    runtime_mode: "terminal" | "daemon";
}

export interface ToastMessage {
    id: string;
    title: string;
    message: string;
    type: "success" | "info" | "error";
}

export interface UserSettings {
    shell: "zsh" | "bash";
    fontSize: number;
    defaultAgent: string;
}

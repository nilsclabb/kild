import type { SessionInfo } from "../types";
import "./Dashboard.css";

interface DashboardProps {
    sessions: SessionInfo[];
    selectedBranch: string | null;
    onSelect: (branch: string) => void;
    onStop: (branch: string) => void;
    onDestroy: (branch: string) => void;
}

export function Dashboard({ sessions, selectedBranch, onSelect, onStop, onDestroy }: DashboardProps) {
    if (sessions.length === 0) {
        return (
            <div className="dashboard-empty">
                <div className="empty-icon">⚡</div>
                <h2>No kilds running</h2>
                <p>Create a new kild to start an AI agent in an isolated worktree.</p>
            </div>
        );
    }

    const selected = selectedBranch ? sessions.find((s) => s.branch === selectedBranch) : null;

    if (selected) {
        return (
            <div className="detail-view">
                <header className="detail-header">
                    <div className="detail-title-row">
                        <button className="btn-back" onClick={() => onSelect("")}>
                            ← Back
                        </button>
                        <h2 className="detail-title">{selected.branch}</h2>
                        <span className={`status-badge status-${selected.status}`}>
                            {selected.status}
                        </span>
                    </div>
                </header>

                <div className="detail-grid">
                    <div className="detail-card">
                        <span className="detail-label">Agent</span>
                        <span className="detail-value">{selected.agent}</span>
                    </div>
                    <div className="detail-card">
                        <span className="detail-label">Runtime</span>
                        <span className="detail-value">{selected.runtime_mode}</span>
                    </div>
                    <div className="detail-card">
                        <span className="detail-label">Git Status</span>
                        <span className="detail-value">{selected.git_dirty ? "Dirty" : "Clean"}</span>
                    </div>
                    <div className="detail-card">
                        <span className="detail-label">Worktree</span>
                        <span className="detail-value detail-path">{selected.worktree_path}</span>
                    </div>
                </div>

                <div className="detail-actions">
                    {selected.status === "running" && (
                        <button className="btn btn-warning" onClick={() => onStop(selected.branch)}>
                            Stop Agent
                        </button>
                    )}
                    <button className="btn btn-danger" onClick={() => onDestroy(selected.branch)}>
                        Destroy Kild
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <h2 className="dashboard-title">Fleet Overview</h2>
            <div className="card-grid">
                {sessions.map((s) => (
                    <div
                        key={s.branch}
                        className="kild-card"
                        onClick={() => onSelect(s.branch)}
                    >
                        <div className="card-header">
                            <span className={`card-dot status-${s.status}`} />
                            <span className="card-branch">{s.branch}</span>
                        </div>
                        <div className="card-body">
                            <span className="card-agent">{s.agent}</span>
                            <span className="card-mode">{s.runtime_mode}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

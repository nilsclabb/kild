import type { SessionInfo } from "../types";
import "./Sidebar.css";

interface SidebarProps {
    sessions: SessionInfo[];
    selectedBranch: string | null;
    onSelect: (branch: string) => void;
    onCreateNew: () => void;
    loading: boolean;
}

export function Sidebar({ sessions, selectedBranch, onSelect, onCreateNew, loading }: SidebarProps) {
    const active = sessions.filter((s) => s.status === "running");
    const stopped = sessions.filter((s) => s.status !== "running");

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <span className="sidebar-label">Sessions</span>
                <button className="btn-create" onClick={onCreateNew} title="Create new kild">
                    +
                </button>
            </div>

            {loading ? (
                <div className="sidebar-loading">Loading sessions…</div>
            ) : sessions.length === 0 ? (
                <div className="sidebar-empty">
                    <p>No kilds yet</p>
                    <p className="sidebar-hint">Click + to create one</p>
                </div>
            ) : (
                <nav className="sidebar-nav">
                    {active.length > 0 && (
                        <section className="sidebar-section">
                            <h2 className="section-header">
                                <span className="status-dot status-running" />
                                Active ({active.length})
                            </h2>
                            <ul className="session-list">
                                {active.map((s) => (
                                    <li
                                        key={s.branch}
                                        className={`session-item ${selectedBranch === s.branch ? "selected" : ""}`}
                                        onClick={() => onSelect(s.branch)}
                                    >
                                        <span className="session-branch">{s.branch}</span>
                                        <span className="session-agent">{s.agent}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {stopped.length > 0 && (
                        <section className="sidebar-section">
                            <h2 className="section-header">
                                <span className="status-dot status-stopped" />
                                Stopped ({stopped.length})
                            </h2>
                            <ul className="session-list">
                                {stopped.map((s) => (
                                    <li
                                        key={s.branch}
                                        className={`session-item ${selectedBranch === s.branch ? "selected" : ""}`}
                                        onClick={() => onSelect(s.branch)}
                                    >
                                        <span className="session-branch">{s.branch}</span>
                                        <span className="session-agent">{s.agent}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </nav>
            )}
        </aside>
    );
}

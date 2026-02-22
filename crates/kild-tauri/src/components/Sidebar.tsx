import { useState } from "react";
import { motion } from "framer-motion";
import type { SessionInfo } from "../types";
import "./Sidebar.css";

interface SidebarProps {
    sessions: SessionInfo[];
    selectedBranch: string | null;
    onSelect: (branch: string) => void;
    onCreateNew: () => void;
    loading: boolean;
    waitingBranches: Set<string>;
    activeWorkspaceName: string;
    activeWorkspacePath?: string;
}

export function Sidebar({ sessions, selectedBranch, onSelect, onCreateNew, loading, waitingBranches, activeWorkspaceName, activeWorkspacePath }: SidebarProps) {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredSessions = sessions.filter(
        (s) =>
            s.branch.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.agent.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const active = filteredSessions.filter((s) => s.status === "running");
    const stopped = filteredSessions.filter((s) => s.status !== "running");

    return (
        <aside className="sidebar">
            <div className="sidebar-titlebar" data-tauri-drag-region>
                <div className="sidebar-workspace-info" data-tauri-drag-region>
                    <div className="sidebar-workspace-name">{activeWorkspaceName}</div>
                    {activeWorkspacePath && (
                        <div className="sidebar-workspace-path" title={activeWorkspacePath}>
                            {activeWorkspacePath}
                        </div>
                    )}
                </div>
            </div>

            <div className="sidebar-header">
                <span className="sidebar-label">Sessions</span>
                <motion.button
                    className="sidebar-header-btn"
                    onClick={onCreateNew}
                    title="Create new kild"
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </motion.button>
            </div>

            <div className="sidebar-search-container">
                <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                    type="text"
                    className="sidebar-search-input"
                    placeholder="Search kilds..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="sidebar-loading">Loading sessions…</div>
            ) : filteredSessions.length === 0 ? (
                <div className="sidebar-empty">
                    {searchQuery ? (
                        <p>No matches found</p>
                    ) : (
                        <>
                            <p>No kilds yet</p>
                            <p className="sidebar-hint">Click + to create one</p>
                        </>
                    )}
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
                                {active.map((s) => {
                                    const isWaiting = waitingBranches.has(s.branch);
                                    return (
                                        <li
                                            key={s.branch}
                                            className={`session-item ${selectedBranch === s.branch ? "selected" : ""}`}
                                            onClick={() => onSelect(s.branch)}
                                        >
                                            <span className={`status-dot ${isWaiting ? "status-pending" : "status-running"}`} style={{ marginRight: 8, opacity: isWaiting ? 1 : 0 }} />
                                            <span className="session-branch">{s.branch}</span>
                                            <span className="session-agent">{s.agent}</span>
                                        </li>
                                    );
                                })}
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

            <div className="sidebar-footer">
                {/* Theme toggle moved to WorkspaceSidebar */}
            </div>
        </aside>
    );
}

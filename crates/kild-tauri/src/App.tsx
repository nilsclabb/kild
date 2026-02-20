import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./components/Dashboard";
import { CreateDialog } from "./components/CreateDialog";
import { Terminal } from "./components/Terminal";
import type { SessionInfo } from "./types";
import "./styles/App.css";

interface ActiveTerminal {
    sessionId: string;
    command: string;
    cwd: string;
    branch: string;
    agent: string;
}

function App() {
    const [sessions, setSessions] = useState<SessionInfo[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"detail" | "grid">("detail");
    const [activeTerminals, setActiveTerminals] = useState<Map<string, ActiveTerminal>>(new Map());
    const [visibleTerminalBranch, setVisibleTerminalBranch] = useState<string | null>(null);

    // Grid focus: when set, one terminal fills the grid
    const [focusedBranch, setFocusedBranch] = useState<string | null>(null);

    const autoConnectedRef = useRef(false);

    const refreshSessions = async () => {
        try {
            const result = await invoke<SessionInfo[]>("list_sessions");
            setSessions(result);
            return result;
        } catch (err) {
            console.error("Failed to list sessions:", err);
            return [];
        } finally {
            setLoading(false);
        }
    };

    const autoConnectSessions = useCallback(async (loadedSessions: SessionInfo[]) => {
        if (autoConnectedRef.current) return;
        autoConnectedRef.current = true;

        const activeSessions = loadedSessions.filter((s) => s.status === "running");
        if (activeSessions.length === 0) return;

        console.log(`[App] Auto-connecting ${activeSessions.length} active session(s)...`);
        const newTerminals = new Map<string, ActiveTerminal>();

        for (const session of activeSessions) {
            try {
                const cmd = await invoke<string>("get_agent_command", { agent: session.agent });
                const termId = `term-${session.session_id}`;
                newTerminals.set(session.branch, {
                    sessionId: termId, command: cmd, cwd: session.worktree_path,
                    branch: session.branch, agent: session.agent,
                });
            } catch (err) {
                console.error(`[App] Failed to auto-connect ${session.branch}:`, err);
            }
        }

        if (newTerminals.size > 0) {
            setActiveTerminals(newTerminals);
            if (newTerminals.size > 1) setViewMode("grid");
        }
    }, []);

    useEffect(() => {
        (async () => {
            const result = await refreshSessions();
            await autoConnectSessions(result);
        })();
        const interval = setInterval(refreshSessions, 3000);
        return () => clearInterval(interval);
    }, [autoConnectSessions]);

    const addTerminal = useCallback(async (session: SessionInfo): Promise<void> => {
        try {
            const cmd = await invoke<string>("get_agent_command", { agent: session.agent });
            const termId = `term-${session.session_id}`;
            setActiveTerminals((prev) => {
                const next = new Map(prev);
                next.set(session.branch, {
                    sessionId: termId, command: cmd, cwd: session.worktree_path,
                    branch: session.branch, agent: session.agent,
                });
                return next;
            });
        } catch (err) {
            console.error("Failed to resolve agent command:", err);
            throw err;
        }
    }, []);

    const handleCreateKild = async (branch: string, agent: string) => {
        try {
            const session = await invoke<SessionInfo>("create_session", { branch, agent });
            setShowCreateDialog(false);
            await refreshSessions();
            setSelectedBranch(session.branch);
            await addTerminal(session);
            setVisibleTerminalBranch(session.branch);
        } catch (err) {
            console.error("Failed to create session:", err);
            alert(`Failed to create kild: ${err}`);
        }
    };

    const handleOpenTerminal = useCallback(async (session: SessionInfo) => {
        if (activeTerminals.has(session.branch)) {
            setVisibleTerminalBranch(session.branch);
            return;
        }
        try {
            await addTerminal(session);
            setVisibleTerminalBranch(session.branch);
        } catch {
            alert("Failed to resolve agent command");
        }
    }, [activeTerminals, addTerminal]);

    const handleCloseTerminal = useCallback(() => setVisibleTerminalBranch(null), []);

    const handleTerminalExit = useCallback((branch: string) => {
        setActiveTerminals((prev) => { const n = new Map(prev); n.delete(branch); return n; });
        if (visibleTerminalBranch === branch) setVisibleTerminalBranch(null);
        if (focusedBranch === branch) setFocusedBranch(null);
    }, [visibleTerminalBranch, focusedBranch]);

    const killTerminal = async (branch: string) => {
        const t = activeTerminals.get(branch);
        if (t) {
            await invoke("close_pty", { sessionId: t.sessionId }).catch(() => { });
            setActiveTerminals((prev) => { const n = new Map(prev); n.delete(branch); return n; });
        }
    };

    const handleStopKild = async (branch: string) => {
        try { await killTerminal(branch); await invoke("stop_session", { branch }); await refreshSessions(); }
        catch (err) { console.error("Failed to stop:", err); }
    };

    const handleDestroyKild = async (branch: string) => {
        try {
            await killTerminal(branch);
            if (visibleTerminalBranch === branch) setVisibleTerminalBranch(null);
            if (focusedBranch === branch) setFocusedBranch(null);
            setSelectedBranch(null);
            await invoke("destroy_session", { branch, force: false });
            await refreshSessions();
        } catch (err) { console.error("Failed to destroy:", err); }
    };

    const terminalEntries = Array.from(activeTerminals.entries());
    const gridCols = terminalEntries.length <= 1 ? 1 : terminalEntries.length <= 4 ? 2 : 3;
    const isDetailTerminalVisible = viewMode === "detail" && visibleTerminalBranch !== null && selectedBranch === visibleTerminalBranch;

    // Dynamic font size: smaller when more terminals in grid
    const gridFontSize = focusedBranch
        ? 13 // focused = normal size
        : terminalEntries.length <= 1 ? 13
            : terminalEntries.length <= 2 ? 11
                : terminalEntries.length <= 4 ? 10
                    : 9;

    return (
        <div className="app">
            <Header
                viewMode={viewMode}
                onViewModeChange={(m) => { setViewMode(m); setFocusedBranch(null); }}
                activeTerminalCount={activeTerminals.size}
            />

            <div className="app-body">
                {viewMode === "detail" && (
                    <Sidebar
                        sessions={sessions}
                        selectedBranch={selectedBranch}
                        onSelect={(b) => {
                            setSelectedBranch(b);
                            setVisibleTerminalBranch(activeTerminals.has(b) ? b : null);
                        }}
                        onCreateNew={() => setShowCreateDialog(true)}
                        loading={loading}
                    />
                )}

                <main className={viewMode === "grid" ? "grid-content" : "main-content"}>
                    {/* ===== Detail mode ===== */}
                    {viewMode === "detail" && (
                        <>
                            <Dashboard
                                sessions={sessions}
                                selectedBranch={selectedBranch}
                                onSelect={(b) => {
                                    setSelectedBranch(b);
                                    if (activeTerminals.has(b)) setVisibleTerminalBranch(b);
                                }}
                                onStop={handleStopKild}
                                onDestroy={handleDestroyKild}
                                onOpenTerminal={handleOpenTerminal}
                                onCloseTerminal={handleCloseTerminal}
                                showTerminal={isDetailTerminalVisible}
                            />

                            {terminalEntries.map(([branch, term]) => (
                                <div
                                    key={term.sessionId}
                                    className="detail-terminal-overlay"
                                    style={{
                                        display: isDetailTerminalVisible && visibleTerminalBranch === branch
                                            ? "flex" : "none",
                                    }}
                                >
                                    <Terminal
                                        sessionId={term.sessionId}
                                        command={term.command}
                                        args={[]}
                                        cwd={term.cwd}
                                        fontSize={13}
                                        onExit={() => handleTerminalExit(branch)}
                                    />
                                </div>
                            ))}
                        </>
                    )}

                    {/* ===== Grid mode ===== */}
                    {viewMode === "grid" && (
                        <>
                            {terminalEntries.length === 0 ? (
                                <div className="grid-empty">
                                    <div className="empty-icon">⚡</div>
                                    <h2>No active terminals</h2>
                                    <p>Create a kild to get started.</p>
                                    <button className="btn btn-terminal" onClick={() => {
                                        setViewMode("detail"); setShowCreateDialog(true);
                                    }}>
                                        + Create Kild
                                    </button>
                                </div>
                            ) : focusedBranch ? (
                                /* Focused: single terminal fills the grid */
                                (() => {
                                    const term = activeTerminals.get(focusedBranch);
                                    if (!term) return null;
                                    return (
                                        <div className="grid-focused">
                                            <div className="grid-focused-header">
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => setFocusedBranch(null)}
                                                >
                                                    ← All Terminals
                                                </button>
                                                <span className="grid-cell-dot" />
                                                <span className="grid-focused-branch">{focusedBranch}</span>
                                                <span className="grid-cell-agent">{term.agent}</span>
                                            </div>
                                            <div className="grid-focused-terminal">
                                                <Terminal
                                                    sessionId={term.sessionId}
                                                    command={term.command}
                                                    args={[]}
                                                    cwd={term.cwd}
                                                    fontSize={13}
                                                    onExit={() => handleTerminalExit(focusedBranch)}
                                                />
                                            </div>
                                        </div>
                                    );
                                })()
                            ) : (
                                /* Grid of all terminals */
                                <div
                                    className="terminal-grid"
                                    style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}
                                >
                                    {terminalEntries.map(([branch, term]) => (
                                        <div
                                            key={term.sessionId}
                                            className="grid-cell"
                                            onDoubleClick={() => setFocusedBranch(branch)}
                                        >
                                            <div className="grid-cell-header">
                                                <span className="grid-cell-dot" />
                                                <span className="grid-cell-branch">{branch}</span>
                                                <span className="grid-cell-agent">{term.agent}</span>
                                                <button
                                                    className="grid-cell-focus-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setFocusedBranch(branch);
                                                    }}
                                                    title="Focus this terminal"
                                                >
                                                    ⤢
                                                </button>
                                            </div>
                                            <div className="grid-cell-terminal">
                                                <Terminal
                                                    sessionId={term.sessionId}
                                                    command={term.command}
                                                    args={[]}
                                                    cwd={term.cwd}
                                                    fontSize={gridFontSize}
                                                    onExit={() => handleTerminalExit(branch)}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </main>
            </div>

            {showCreateDialog && (
                <CreateDialog
                    onSubmit={handleCreateKild}
                    onClose={() => setShowCreateDialog(false)}
                />
            )}
        </div>
    );
}

export default App;

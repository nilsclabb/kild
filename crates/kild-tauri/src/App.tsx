import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./components/Dashboard";
import { CreateDialog } from "./components/CreateDialog";
import { Terminal } from "./components/Terminal";
import { ToastContainer } from "./components/Toast";
import { SettingsDialog } from "./components/SettingsDialog";
import type { SessionInfo, ToastMessage, UserSettings } from "./types";
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
    const [showSettingsDialog, setShowSettingsDialog] = useState(false);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"detail" | "grid">("detail");
    const [activeTerminals, setActiveTerminals] = useState<Map<string, ActiveTerminal>>(new Map());
    const [visibleTerminalBranch, setVisibleTerminalBranch] = useState<string | null>(null);
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const addToast = useCallback((title: string, message: string, type: "success" | "error" | "info" = "info") => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, title, message, type }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    // Theme state: defaults to dark
    const [theme, setTheme] = useState<"dark" | "light">(() => {
        return (localStorage.getItem("kild-theme") as "dark" | "light") || "dark";
    });

    // Settings state
    const [userSettings, setUserSettings] = useState<UserSettings>(() => {
        const stored = localStorage.getItem("kild-settings");
        if (stored) {
            try {
                return JSON.parse(stored) as UserSettings;
            } catch (e) {
                console.error("Failed to parse settings", e);
            }
        }
        return {
            shell: "zsh",
            fontSize: 14,
            defaultAgent: "kild"
        };
    });

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

    // Apply theme to HTML tag
    useEffect(() => {
        const html = document.documentElement;
        if (theme === "light") {
            html.classList.add("theme-light");
        } else {
            html.classList.remove("theme-light");
        }
        localStorage.setItem("kild-theme", theme);
    }, [theme]);

    const toggleTheme = () => setTheme(prev => prev === "dark" ? "light" : "dark");

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

    const handleCreateKild = async (branch: string, agent: string, runtime: string = "docker") => {
        try {
            const session = await invoke<SessionInfo>("create_session", { branch, agent, runtime_mode: runtime, focus: false });
            setShowCreateDialog(false);
            await refreshSessions();
            setSelectedBranch(session.branch);
            await addTerminal(session);
            setVisibleTerminalBranch(session.branch);
            addToast("Session Created", `Successfully started kild for ${branch}`, "success");
        } catch (err: any) {
            console.error("Failed to create session:", err);
            addToast("Creation Failed", err.toString(), "error");
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
        try {
            await killTerminal(branch);
            await invoke("stop_session", { branch });
            await refreshSessions();
            addToast("Session Stopped", `Agent for ${branch} has been stopped`, "info");
        } catch (err: any) {
            console.error("Failed to stop:", err);
            addToast("Stop Failed", err.toString(), "error");
        }
    };

    const handleDestroyKild = async (branch: string) => {
        try {
            await killTerminal(branch);
            if (visibleTerminalBranch === branch) setVisibleTerminalBranch(null);
            if (focusedBranch === branch) setFocusedBranch(null);
            setSelectedBranch(null);
            await invoke("destroy_session", { branch, force: false });
            await refreshSessions();
            addToast("Session Destroyed", `Worktree for ${branch} was deleted`, "info");
        } catch (err: any) {
            console.error("Failed to destroy:", err);
            addToast("Destroy Failed", err.toString(), "error");
        }
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
        <div className="app" data-tauri-drag-region>
            <Header
                viewMode={viewMode}
                onViewModeChange={(m) => { setViewMode(m); setFocusedBranch(null); }}
                activeTerminalCount={activeTerminals.size}
                onOpenSettings={() => setShowSettingsDialog(true)}
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
                        theme={theme}
                        onToggleTheme={toggleTheme}
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
                                        fontSize={userSettings.fontSize}
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
                                <div className="empty-state-wrapper">
                                    <div className="empty-state-card">
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="empty-icon-svg">
                                            <polyline points="4 17 10 11 4 5"></polyline>
                                            <line x1="12" y1="19" x2="20" y2="19"></line>
                                        </svg>
                                        <h2>No active terminals</h2>
                                        <p>Create a kild to get started.</p>
                                        <button className="btn btn-primary" onClick={() => {
                                            setViewMode("detail"); setShowCreateDialog(true);
                                        }}>
                                            + Create Kild
                                        </button>
                                    </div>
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
                                                    fontSize={userSettings.fontSize}
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

            <ToastContainer toasts={toasts} onDismiss={removeToast} />

            {showSettingsDialog && (
                <SettingsDialog
                    initialSettings={userSettings}
                    onClose={() => setShowSettingsDialog(false)}
                    onSave={(settings) => {
                        setUserSettings(settings);
                        localStorage.setItem("kild-settings", JSON.stringify(settings));
                        addToast("Settings Saved", "Your preferences have been updated.", "success");
                    }}
                />
            )}

            {showCreateDialog && (
                <CreateDialog
                    onSubmit={(branch, agent, runtime) => handleCreateKild(branch, agent, runtime)}
                    onClose={() => setShowCreateDialog(false)}
                />
            )}
        </div>
    );
}

export default App;

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./components/Dashboard";
import { CreateDialog } from "./components/CreateDialog";
import { Terminal } from "./components/Terminal";
import { ToastContainer } from "./components/Toast";
import { SettingsDialog } from "./components/SettingsDialog";
import { WorkspaceSidebar, type WorkspaceItemData } from "./components/WorkspaceSidebar";
import { AnimatePresence } from "framer-motion";
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
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
    const [activeTerminals, setActiveTerminals] = useState<Map<string, ActiveTerminal>>(new Map());
    const [waitingBranches, setWaitingBranches] = useState<Set<string>>(new Set());
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

    // Static manually added workspaces
    const [staticWorkspaces, setStaticWorkspaces] = useState<{ id: string, name: string, initials: string, path: string }[]>(() => {
        const stored = localStorage.getItem("kild-workspaces");
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.error("Failed to parse workspaces", e);
            }
        }
        return [];
    });

    // Auto-migrate old workspaces that lack an MD5 hash ID
    useEffect(() => {
        let mounted = true;
        const migrate = async () => {
            const needsMigration = staticWorkspaces.some(w => w.id === w.name || w.id.length < 32);
            if (!needsMigration) return;

            let changed = false;
            const updated = await Promise.all(staticWorkspaces.map(async (ws) => {
                if (ws.id === ws.name || ws.id.length < 32) {
                    try {
                        const proj = await invoke<any>("get_project_info", { path: ws.path });
                        if (proj && proj.id && proj.id !== ws.id) {
                            changed = true;
                            // Preserve user-added properties, but upgrade the ID and formal Name
                            return { ...ws, id: proj.id, name: proj.name };
                        }
                    } catch (err) {
                        // ignore failures such as missing folders
                    }
                }
                return ws;
            }));

            if (mounted && changed) {
                // Deduplicate securely against any overlaps
                const map = new Map();
                updated.forEach(u => map.set(u.id, u));
                const finalList = Array.from(map.values());

                setStaticWorkspaces(finalList);
                localStorage.setItem("kild-workspaces", JSON.stringify(finalList));

                // Align activeWorkspaceId if it was relying on an old invalid ID
                if (activeWorkspaceId) {
                    const migrated = finalList.find(w => w.name === activeWorkspaceId || w.path === activeWorkspaceId);
                    if (migrated) {
                        setActiveWorkspaceId(migrated.id);
                    }
                }
            }
        };
        migrate();
        return () => { mounted = false; };
    }, [staticWorkspaces, activeWorkspaceId]);

    const handleAddWorkspace = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: "Select Git Repository"
            });
            if (selected && typeof selected === "string") {
                // Call backend to get real project info so we match dynamic sessions
                const project = await invoke<any>("get_project_info", { path: selected });
                if (!project || !project.id) {
                    throw new Error("Invalid project info from backend");
                }
                const { id, name } = project;
                const initials = name && name.length > 0 ? name.charAt(0).toUpperCase() : "?";

                // Add to static workspaces if not already present
                setStaticWorkspaces(prev => {
                    if (prev.find(w => w.id === id)) return prev;
                    const next = [...prev, { id, name, initials, path: selected }];
                    localStorage.setItem("kild-workspaces", JSON.stringify(next));
                    return next;
                });

                // Auto select it
                setActiveWorkspaceId(id);
                setSelectedBranch(null);
            }
        } catch (err) {
            console.error("Failed to add workspace:", err);
            addToast("Add Failed", "Could not open folder picker", "error");
        }
    };

    const handleRemoveWorkspace = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setStaticWorkspaces(prev => {
            const next = prev.filter(w => w.id !== id);
            localStorage.setItem("kild-workspaces", JSON.stringify(next));
            return next;
        });
        if (activeWorkspaceId === id) {
            setActiveWorkspaceId(null);
        }
    };

    // Grid focus: when set, one terminal fills the grid
    const [focusedBranch, setFocusedBranch] = useState<string | null>(null);

    // Compute workspaces and auto-select
    const workspaces = useMemo(() => {
        const spaceMap = new Map<string, WorkspaceItemData>();

        // 1. Prioritize static workspaces to ensure correct human readable names and repo paths
        for (const std of staticWorkspaces) {
            spaceMap.set(std.id, {
                id: std.id,
                name: std.name,
                initials: std.initials,
                activeCount: 0,
                hasWaiting: false,
                path: std.path
            });
        }

        // 2. Add dynamically spawned sessions
        for (const session of sessions) {
            const pid = session.project_id;
            if (!spaceMap.has(pid)) {
                // If this project isn't statically pinned, try to guess the true repo name from the worktree
                let name = pid; // fallback fully to ID hash
                const parts = session.worktree_path?.split(/[\/\\]/) || [];
                if (parts.length >= 2) {
                    // Because format is ~/.kild/worktrees/<project_name>/<branch>
                    name = parts[parts.length - 2];
                }
                const initials = name && name.length > 0 ? name.charAt(0).toUpperCase() : "?";

                spaceMap.set(pid, {
                    id: pid,
                    name,
                    initials,
                    activeCount: 0,
                    hasWaiting: false,
                    path: undefined // We only definitively know the worktree path, not the generic repo path here.
                });
            }

            const ws = spaceMap.get(pid)!;
            if (session.status === "running") {
                ws.activeCount++;
            }
            if (waitingBranches.has(session.branch)) {
                ws.hasWaiting = true;
            }
        }

        return Array.from(spaceMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [sessions, waitingBranches, staticWorkspaces]);

    useEffect(() => {
        if (!activeWorkspaceId && workspaces.length > 0) {
            setActiveWorkspaceId(workspaces[0].id);
            setSelectedBranch(null);
        } else if (activeWorkspaceId && workspaces.length > 0 && !workspaces.find(w => w.id === activeWorkspaceId)) {
            setActiveWorkspaceId(workspaces[0].id);
            setSelectedBranch(null);
        }
    }, [workspaces, activeWorkspaceId]);

    const workspaceSessions = useMemo(() => {
        if (!activeWorkspaceId) return [];
        return sessions.filter(s => s.project_id === activeWorkspaceId);
    }, [sessions, activeWorkspaceId]);

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
            // Find cwd from active workspace if any
            let targetCwd: string | undefined = undefined;
            if (activeWorkspaceId) {
                const ws = workspaces.find(w => w.id === activeWorkspaceId);
                if (ws && ws.path) {
                    targetCwd = ws.path;
                }
            }

            const session = await invoke<SessionInfo>("create_session", {
                branch,
                agent,
                runtime_mode: runtime,
                focus: false,
                cwd: targetCwd
            });
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
        setWaitingBranches((prev) => { const n = new Set(prev); n.delete(branch); return n; });
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
    const workspaceTerminalEntries = terminalEntries.filter(([b]) => {
        const s = sessions.find((sx) => sx.branch === b);
        return s?.project_id === activeWorkspaceId;
    });

    const gridCols = workspaceTerminalEntries.length <= 1 ? 1 : workspaceTerminalEntries.length <= 4 ? 2 : 3;
    const isDetailTerminalVisible = viewMode === "detail" && visibleTerminalBranch !== null && selectedBranch === visibleTerminalBranch;

    // Dynamic font size: smaller when more terminals in grid
    const gridFontSize = focusedBranch
        ? 13 // focused = normal size
        : workspaceTerminalEntries.length <= 1 ? 13
            : workspaceTerminalEntries.length <= 2 ? 11
                : workspaceTerminalEntries.length <= 4 ? 10
                    : 9;

    return (
        <div className="app" data-tauri-drag-region>
            <WorkspaceSidebar
                workspaces={workspaces}
                activeWorkspaceId={activeWorkspaceId}
                onSelectWorkspace={(id) => {
                    setActiveWorkspaceId(id);
                    setSelectedBranch(null);
                    setFocusedBranch(null);
                    setVisibleTerminalBranch(null);
                }}
                onAddWorkspace={handleAddWorkspace}
                onRemoveWorkspace={handleRemoveWorkspace}
                onOpenSettings={() => setShowSettingsDialog(true)}
                theme={theme}
                onToggleTheme={toggleTheme}
            />

            <div className="app-main-column">
                <Header
                    viewMode={viewMode}
                    onViewModeChange={(m) => { setViewMode(m); setFocusedBranch(null); }}
                />

                <div className="app-body">
                    {viewMode === "detail" && (
                        <Sidebar
                            sessions={workspaceSessions}
                            selectedBranch={selectedBranch}
                            onSelect={(b) => {
                                setSelectedBranch(b);
                                setVisibleTerminalBranch(activeTerminals.has(b) ? b : null);
                            }}
                            onCreateNew={() => setShowCreateDialog(true)}
                            loading={loading}
                            waitingBranches={waitingBranches}
                            activeWorkspaceName={workspaces.find(w => w.id === activeWorkspaceId)?.name || "Kild"}
                            activeWorkspacePath={workspaces.find(w => w.id === activeWorkspaceId)?.path}
                        />
                    )}

                    <main className={viewMode === "grid" ? "grid-content" : "main-content"}>
                        {/* ===== Detail mode ===== */}
                        {viewMode === "detail" && (
                            <>
                                <Dashboard
                                    sessions={workspaceSessions}
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
                                    waitingBranches={waitingBranches}
                                />

                                {workspaceTerminalEntries.map(([branch, term]) => {
                                    const session = sessions.find((s) => s.branch === branch);
                                    return (
                                        <div
                                            key={term.sessionId}
                                            className="detail-terminal-overlay"
                                            style={{
                                                display: isDetailTerminalVisible && visibleTerminalBranch === branch
                                                    ? "flex" : "none",
                                                position: "relative"
                                            }}
                                        >
                                            <div className="terminal-card" style={{ width: '100%', height: '100%' }}>
                                                <div className="terminal-header">
                                                    <div className="terminal-header-info">
                                                        <span className={`terminal-status-dot status-${session?.status || "running"}`} />
                                                        <span className="terminal-branch-label">{branch}</span>
                                                        <span className="terminal-agent-pill">{term.agent}</span>
                                                    </div>
                                                    <button
                                                        className="btn btn-icon"
                                                        style={{ width: 'auto', padding: '0 12px', zIndex: 10, pointerEvents: 'auto' }}
                                                        onClick={handleCloseTerminal}
                                                        title="Hide Terminal"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                                        </svg>
                                                        <span>Close Terminal</span>
                                                    </button>
                                                </div>
                                                <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
                                                    <Terminal
                                                        sessionId={term.sessionId}
                                                        command={term.command}
                                                        args={[]}
                                                        cwd={term.cwd}
                                                        fontSize={userSettings.fontSize}
                                                        onExit={() => handleTerminalExit(branch)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </>
                        )}

                        {/* ===== Grid mode ===== */}
                        {viewMode === "grid" && (
                            <>
                                {workspaceTerminalEntries.length === 0 ? (
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
                                        {workspaceTerminalEntries.map(([branch, term]) => (
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

                <AnimatePresence>
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
                </AnimatePresence>

                <AnimatePresence>
                    {showCreateDialog && (
                        <CreateDialog
                            onSubmit={(branch, agent) => handleCreateKild(branch, agent)}
                            onClose={() => setShowCreateDialog(false)}
                        />
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default App;

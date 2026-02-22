import "./WorkspaceSidebar.css";

export interface WorkspaceItemData {
    id: string;
    name: string;
    initials: string;
    activeCount: number;
    hasWaiting: boolean;
    path?: string;
}

interface WorkspaceSidebarProps {
    workspaces: WorkspaceItemData[];
    activeWorkspaceId: string | null;
    onSelectWorkspace: (id: string) => void;
    onAddWorkspace: () => void;
    onRemoveWorkspace: (id: string, e: React.MouseEvent) => void;
    onOpenSettings: () => void;
    theme: "light" | "dark";
    onToggleTheme: () => void;
}

export function WorkspaceSidebar({ workspaces, activeWorkspaceId, onSelectWorkspace, onAddWorkspace, onRemoveWorkspace, onOpenSettings, theme, onToggleTheme }: WorkspaceSidebarProps) {
    return (
        <nav className="workspace-sidebar" data-tauri-drag-region>
            <div className="workspace-traffic-lights" data-tauri-drag-region>
                {/* Space reserved for macOS traffic lights */}
            </div>

            <div className="workspace-items">
                {workspaces.map((ws) => (
                    <button
                        key={ws.id}
                        className={`workspace-item ${activeWorkspaceId === ws.id ? "active" : ""}`}
                        onClick={() => onSelectWorkspace(ws.id)}
                        title={`Workspace: ${ws.name}`}
                    >
                        <span className="workspace-item-initials">{ws.initials}</span>
                        {ws.hasWaiting ? (
                            <span className="workspace-badge pending" title="Waiting for input" />
                        ) : ws.activeCount > 0 ? (
                            <span className="workspace-badge">{ws.activeCount}</span>
                        ) : null}
                        {ws.path && (
                            <div
                                className="workspace-item-remove"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveWorkspace(ws.id, e);
                                }}
                                title="Remove Workspace"
                            >
                                ×
                            </div>
                        )}
                    </button>
                ))}

                <div className="workspace-divider" />

                <button className="workspace-item workspace-add" title="Add Workspace" onClick={onAddWorkspace}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
            </div>

            <div className="workspace-footer">
                <button
                    className="workspace-item workspace-settings"
                    onClick={onToggleTheme}
                    title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                    style={{ marginBottom: "8px" }}
                >
                    {theme === 'dark' ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
                        </svg>
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="4"></circle>
                            <path d="M12 2v2"></path>
                            <path d="M12 20v2"></path>
                            <path d="m4.93 4.93 1.41 1.41"></path>
                            <path d="m17.66 17.66 1.41 1.41"></path>
                            <path d="M2 12h2"></path>
                            <path d="M20 12h2"></path>
                            <path d="m6.34 17.66-1.41 1.41"></path>
                            <path d="m19.07 4.93-1.41 1.41"></path>
                        </svg>
                    )}
                </button>
                <button className="workspace-item workspace-settings" title="Settings" onClick={onOpenSettings}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                </button>
            </div>
        </nav>
    );
}

import "./Header.css";

interface HeaderProps {
    viewMode: "detail" | "grid";
    onViewModeChange: (mode: "detail" | "grid") => void;
    activeTerminalCount: number;
    onOpenSettings: () => void;
}

export function Header({ viewMode, onViewModeChange, activeTerminalCount, onOpenSettings }: HeaderProps) {
    return (
        <header className="app-header" data-tauri-drag-region>
            <div className="header-left" data-tauri-drag-region>
                <h1 className="header-title" data-tauri-drag-region>KILD</h1>
            </div>

            <div className="header-center">
                <div className="view-toggle">
                    <button
                        className={`toggle-btn ${viewMode === "detail" ? "active" : ""}`}
                        onClick={() => onViewModeChange("detail")}
                        title="Detail View"
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            <rect x="4" y="4" width="8" height="2" rx="0.5" />
                            <rect x="4" y="7.5" width="5" height="2" rx="0.5" />
                            <rect x="4" y="11" width="6" height="2" rx="0.5" />
                        </svg>
                        <span>Detail</span>
                    </button>
                    <button
                        className={`toggle-btn ${viewMode === "grid" ? "active" : ""}`}
                        onClick={() => onViewModeChange("grid")}
                        title="Grid View — All Terminals"
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <rect x="1" y="1" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            <rect x="9" y="1" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            <rect x="1" y="9" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            <rect x="9" y="9" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                        <span>Grid</span>
                        {activeTerminalCount > 0 && (
                            <span className="terminal-count">{activeTerminalCount}</span>
                        )}
                    </button>
                </div>
            </div>

            <div className="header-right">
                <button
                    className="toggle-btn"
                    onClick={onOpenSettings}
                    title="Open Settings"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"></path>
                    </svg>
                </button>
            </div>
        </header>
    );
}

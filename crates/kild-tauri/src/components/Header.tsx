import "./Header.css";

interface HeaderProps {
    viewMode: "detail" | "grid";
    onViewModeChange: (mode: "detail" | "grid") => void;
    activeTerminalCount: number;
}

export function Header({ viewMode, onViewModeChange, activeTerminalCount }: HeaderProps) {
    return (
        <header className="app-header">
            <div className="header-left">
                <h1 className="header-title">KILD</h1>
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

            <div className="header-right" />
        </header>
    );
}

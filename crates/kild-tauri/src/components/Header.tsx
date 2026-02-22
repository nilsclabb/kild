import { motion } from "framer-motion";
import "./Header.css";

interface HeaderProps {
    viewMode: "detail" | "grid";
    onViewModeChange: (mode: "detail" | "grid") => void;
}

export function Header({ viewMode, onViewModeChange }: HeaderProps) {
    return (
        <header className="app-header" data-tauri-drag-region>
            <div className="header-left" data-tauri-drag-region>
                <h1 className="header-title" data-tauri-drag-region>KILD</h1>
            </div>

            <div className="header-center">
                <div className="view-toggle">
                    <motion.button
                        className={`toggle-btn ${viewMode === "detail" ? "active" : ""}`}
                        onClick={() => onViewModeChange("detail")}
                        title="Detail View"
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            <rect x="4" y="4" width="8" height="2" rx="0.5" />
                            <rect x="4" y="7.5" width="5" height="2" rx="0.5" />
                            <rect x="4" y="11" width="6" height="2" rx="0.5" />
                        </svg>
                        <span>Detail</span>
                    </motion.button>
                    <motion.button
                        className={`toggle-btn ${viewMode === "grid" ? "active" : ""}`}
                        onClick={() => onViewModeChange("grid")}
                        title="Grid View — All Terminals"
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <rect x="1" y="1" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            <rect x="9" y="1" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            <rect x="1" y="9" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            <rect x="9" y="9" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                        <span>Grid</span>
                    </motion.button>
                </div>
            </div>

            <div className="header-right" data-tauri-drag-region>
                {/* Reserved for future right-aligned header items */}
            </div>
        </header>
    );
}

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { UserSettings } from "../types";
import "./SettingsDialog.css";

interface SettingsDialogProps {
    initialSettings: UserSettings;
    onClose: () => void;
    onSave: (settings: UserSettings) => void;
}

export function SettingsDialog({ initialSettings, onClose, onSave }: SettingsDialogProps) {
    const [shell, setShell] = useState<"zsh" | "bash">(initialSettings.shell);
    const [fontSize, setFontSize] = useState<number>(initialSettings.fontSize);
    const [defaultAgent, setDefaultAgent] = useState<string>(initialSettings.defaultAgent);

    // Press Escape to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ shell, fontSize, defaultAgent });
        onClose();
    };

    return (
        <motion.div
            className="dialog-overlay"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
        >
            <motion.div
                className="dialog-content settings-dialog"
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.9, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
                <header className="dialog-header">
                    <h2 className="dialog-title">Preferences</h2>
                    <button className="dialog-close" onClick={onClose}>✕</button>
                </header>

                <form onSubmit={handleSave} className="dialog-form">

                    <div className="settings-section">
                        <h3 className="settings-section-title">Terminal</h3>

                        <div className="form-group">
                            <label className="form-label" htmlFor="shell">Default Shell</label>
                            <select
                                id="shell"
                                className="form-input form-select"
                                value={shell}
                                onChange={(e) => setShell(e.target.value as "zsh" | "bash")}
                            >
                                <option value="zsh">/bin/zsh</option>
                                <option value="bash">/bin/bash</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="fontSize">Font Size</label>
                            <input
                                id="fontSize"
                                type="range"
                                min="10"
                                max="24"
                                className="form-range"
                                value={fontSize}
                                onChange={(e) => setFontSize(Number(e.target.value))}
                            />
                            <div className="range-display">{fontSize}px</div>
                        </div>
                    </div>

                    <div className="settings-section">
                        <h3 className="settings-section-title">Agents</h3>

                        <div className="form-group">
                            <label className="form-label" htmlFor="defaultAgent">Default Agent</label>
                            <select
                                id="defaultAgent"
                                className="form-input form-select"
                                value={defaultAgent}
                                onChange={(e) => setDefaultAgent(e.target.value)}
                            >
                                <option value="kild">kild (Default)</option>
                                <option value="archon">archon</option>
                                <option value="kiro">kiro</option>
                            </select>
                        </div>
                    </div>

                    <footer className="dialog-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary">
                            Save Preferences
                        </button>
                    </footer>
                </form>
            </motion.div>
        </motion.div>
    );
}

import { useState } from "react";
import { motion } from "framer-motion";
import "./CreateDialog.css";

interface CreateDialogProps {
    onSubmit: (branch: string, agent: string) => void;
    onClose: () => void;
}

const AGENTS = ["claude", "gemini", "kiro", "codex"];

export function CreateDialog({ onSubmit, onClose }: CreateDialogProps) {
    const [branch, setBranch] = useState("");
    const [agent, setAgent] = useState("claude");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (branch.trim()) {
            onSubmit(branch.trim(), agent);
        }
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
                className="dialog"
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.9, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
                <h2 className="dialog-title">Create New Kild</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="branch">
                            Branch Name
                        </label>
                        <input
                            id="branch"
                            type="text"
                            className="form-input"
                            value={branch}
                            onChange={(e) => setBranch(e.target.value)}
                            placeholder="e.g. feature/auth"
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="agent">
                            Agent
                        </label>
                        <select
                            id="agent"
                            className="form-select"
                            value={agent}
                            onChange={(e) => setAgent(e.target.value)}
                        >
                            {AGENTS.map((a) => (
                                <option key={a} value={a}>
                                    {a}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="dialog-actions">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={!branch.trim()}
                        >
                            Create
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
}

import { useState } from "react";
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
        <div className="dialog-overlay" onClick={onClose}>
            <div className="dialog" onClick={(e) => e.stopPropagation()}>
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
            </div>
        </div>
    );
}

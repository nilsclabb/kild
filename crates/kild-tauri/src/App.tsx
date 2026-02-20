import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./components/Dashboard";
import { CreateDialog } from "./components/CreateDialog";
import type { SessionInfo } from "./types";
import "./styles/App.css";

function App() {
    const [sessions, setSessions] = useState<SessionInfo[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [loading, setLoading] = useState(true);

    const refreshSessions = async () => {
        try {
            const result = await invoke<SessionInfo[]>("list_sessions");
            setSessions(result);
        } catch (err) {
            console.error("Failed to list sessions:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshSessions();
        // Poll for updates every 3 seconds
        const interval = setInterval(refreshSessions, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleCreateKild = async (branch: string, agent: string) => {
        try {
            await invoke("create_session", { branch, agent });
            setShowCreateDialog(false);
            await refreshSessions();
        } catch (err) {
            console.error("Failed to create session:", err);
        }
    };

    const handleStopKild = async (branch: string) => {
        try {
            await invoke("stop_session", { branch });
            await refreshSessions();
        } catch (err) {
            console.error("Failed to stop session:", err);
        }
    };

    const handleDestroyKild = async (branch: string) => {
        try {
            await invoke("destroy_session", { branch, force: false });
            await refreshSessions();
        } catch (err) {
            console.error("Failed to destroy session:", err);
        }
    };

    return (
        <div className="app">
            <Sidebar
                sessions={sessions}
                selectedBranch={selectedBranch}
                onSelect={setSelectedBranch}
                onCreateNew={() => setShowCreateDialog(true)}
                loading={loading}
            />
            <main className="main-content">
                <Dashboard
                    sessions={sessions}
                    selectedBranch={selectedBranch}
                    onSelect={setSelectedBranch}
                    onStop={handleStopKild}
                    onDestroy={handleDestroyKild}
                />
            </main>

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

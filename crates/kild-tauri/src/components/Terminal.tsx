import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import "./Terminal.css";

interface TerminalProps {
    sessionId: string;
    command: string;
    args: string[];
    cwd: string;
    fontSize?: number;
    onExit?: () => void;
    onPromptChange?: (active: boolean) => void;
}

export function Terminal({ sessionId, command, cwd, fontSize = 13, onExit, onPromptChange }: TerminalProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const onExitRef = useRef(onExit);
    useEffect(() => { onExitRef.current = onExit; }, [onExit]);

    const onPromptChangeRef = useRef(onPromptChange);
    useEffect(() => { onPromptChangeRef.current = onPromptChange; }, [onPromptChange]);
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);

    // Prompt state
    const [promptState, setPromptState] = useState<{ active: boolean; label: string }>({ active: false, label: "" });
    const bufferRef = useRef("");
    const timeoutRef = useRef<number | null>(null);

    // Handle font size changes without re-creating the terminal
    useEffect(() => {
        if (xtermRef.current) {
            xtermRef.current.options.fontSize = fontSize;
            if (fitAddonRef.current) {
                try { fitAddonRef.current.fit(); } catch { /* ignore */ }
            }
        }
    }, [fontSize]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const xterm = new XTerm({
            cursorBlink: true,
            fontSize,
            fontFamily: "monospace",
            theme: {
                background: "#0e1012",
                foreground: "#c0c5ce",
                cursor: "#7eb8da",
            },
            rows: 24,
            cols: 80,
        });

        const fitAddon = new FitAddon();
        xterm.loadAddon(fitAddon);
        xterm.open(el);
        xtermRef.current = xterm;
        fitAddonRef.current = fitAddon;

        requestAnimationFrame(() => {
            try { fitAddon.fit(); } catch { /* ignore */ }
        });

        // Forward keyboard input to PTY
        const dataDisposable = xterm.onData(async (data: string) => {
            try {
                await invoke("write_pty", { sessionId, data });
            } catch { /* PTY closed */ }
        });

        // Listen for PTY output
        const unlistenOutput = listen<{ session_id: string; data: string }>(
            "pty-output",
            (event) => {
                if (event.payload.session_id === sessionId) {
                    const raw = atob(event.payload.data);
                    const bytes = new Uint8Array(raw.length);
                    for (let i = 0; i < raw.length; i++) {
                        bytes[i] = raw.charCodeAt(i);
                    }
                    // Strip ANSI codes for logic processing
                    const clean = raw.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
                    bufferRef.current += clean;
                    if (bufferRef.current.length > 500) {
                        bufferRef.current = bufferRef.current.slice(-500);
                    }

                    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);

                    // Hide prompt overlay immediately when new text comes in (implying agent is working)
                    setPromptState(prev => {
                        if (prev.active) {
                            onPromptChangeRef.current?.(false);
                            return { active: false, label: "" };
                        }
                        return prev;
                    });

                    // If stream goes silent for 600ms, check if we're hanging on a prompt
                    timeoutRef.current = window.setTimeout(() => {
                        const b = bufferRef.current;

                        // Look for common interactive CLI prompts at the end of the buffer
                        const patterns = [
                            /([a-zA-Z0-9 _-]*)\s*\[[yY]\/[nN]\]\s*$/s,
                            /([a-zA-Z0-9 _-]*)\s*\(\s*[yY]es\s*\/\s*[nN]o\s*\)\s*$/s,
                            /(password|username|token|key):\s*$/si,
                            /([a-zA-Z0-9 _-]+)\s*\?\s*$/s,
                            /Select an option.*$/si,
                            /\>\s*$/s,
                        ];

                        for (const p of patterns) {
                            const match = b.match(p);
                            if (match) {
                                let label = match[1] || "Input Required";
                                // Get the last line
                                label = label.split('\n').pop()?.trim() || "Input Required";
                                // Don't show ridiculously long labels
                                if (label.length > 60) label = "Agent Needs Direction";

                                setPromptState({ active: true, label: label + "?" });
                                onPromptChangeRef.current?.(true);
                                break;
                            }
                        }
                    }, 600);
                }
            }
        );

        // Listen for PTY exit
        const unlistenExit = listen<string>("pty-exit", (event) => {
            if (event.payload === sessionId) {
                xterm.writeln("\r\n\x1b[90m[Process exited]\x1b[0m");
                onExitRef.current?.();
            }
        });

        // Spawn PTY via login shell
        invoke("spawn_pty", {
            sessionId,
            command: "/bin/zsh",
            args: ["-l", "-c", command],
            cwd,
            cols: xterm.cols,
            rows: xterm.rows,
        })
            .then(() => console.log("[Terminal] PTY spawned:", sessionId))
            .catch((err) => {
                const errStr = String(err);
                if (errStr.includes("already exists")) {
                    console.log("[Terminal] Re-attached:", sessionId);
                } else {
                    console.error("[Terminal] PTY failed:", err);
                    xterm.writeln(`\x1b[31mError: ${err}\x1b[0m`);
                }
            });

        // Handle resize
        const resizeObserver = new ResizeObserver(() => {
            try {
                fitAddon.fit();
                invoke("resize_pty", {
                    sessionId,
                    cols: xterm.cols,
                    rows: xterm.rows,
                }).catch(() => { });
            } catch { /* ignore */ }
        });
        resizeObserver.observe(el);

        return () => {
            resizeObserver.disconnect();
            dataDisposable.dispose();
            unlistenOutput.then((f) => f());
            unlistenExit.then((f) => f());
            xtermRef.current = null;
            fitAddonRef.current = null;
            xterm.dispose();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId]);

    return (
        <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 0 }}>
            <div
                ref={containerRef}
                className="terminal-container"
            />
            {promptState.active && (
                <div className="terminal-prompt-overlay" onClick={(e) => e.stopPropagation()}>
                    <div className="terminal-prompt-glass glass">
                        <div className="prompt-header">
                            <span className="status-dot status-pending" />
                            <span className="prompt-label">{promptState.label}</span>
                        </div>
                        <div className="prompt-input-wrapper">
                            <input
                                className="prompt-input"
                                type="text"
                                autoFocus
                                placeholder="Type your response..."
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const val = e.currentTarget.value;
                                        invoke("write_pty", { sessionId, data: val + "\r" }).catch(() => { });
                                        setPromptState({ active: false, label: "" });
                                        onPromptChangeRef.current?.(false);
                                        bufferRef.current = ""; // Reset buffer
                                    } else if (e.key === 'Escape') {
                                        setPromptState({ active: false, label: "" });
                                        onPromptChangeRef.current?.(false);
                                    }
                                }}
                            />
                            <kbd className="prompt-hint">↵ Enter to submit</kbd>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

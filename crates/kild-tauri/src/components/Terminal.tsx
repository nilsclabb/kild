import { useEffect, useRef } from "react";
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
}

export function Terminal({ sessionId, command, cwd, fontSize = 13, onExit }: TerminalProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const onExitRef = useRef(onExit);
    onExitRef.current = onExit;
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);

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
                    xterm.write(bytes);
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
        <div
            ref={containerRef}
            className="terminal-container"
        />
    );
}

//! PTY session manager for embedded terminal.
//!
//! Manages pseudo-terminal sessions entirely within the Tauri app.
//! PTY sessions stay alive when the terminal UI is closed.

use portable_pty::{CommandBuilder, MasterPty, PtySize, native_pty_system};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use std::thread;

/// A single PTY session.
struct PtySession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
}

/// Thread-safe registry of active PTY sessions.
pub struct PtyManager {
    sessions: Mutex<HashMap<String, PtySession>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    /// Check whether a PTY session already exists for this ID.
    pub fn has_session(&self, session_id: &str) -> bool {
        self.sessions.lock().unwrap().contains_key(session_id)
    }

    /// Spawn a new PTY with the given command.
    ///
    /// `on_output` is called with terminal data (or empty slice for EOF/exit).
    pub fn spawn(
        &self,
        session_id: &str,
        command: &str,
        args: &[&str],
        cwd: &str,
        cols: u16,
        rows: u16,
        on_output: impl Fn(&str, &[u8]) + Send + 'static,
    ) -> Result<(), String> {
        // Refuse to spawn if a session with this ID already exists
        if self.has_session(session_id) {
            return Err(format!("PTY session '{}' already exists", session_id));
        }

        let pty_system = native_pty_system();

        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to open PTY: {}", e))?;

        let mut cmd = CommandBuilder::new(command);
        cmd.args(args);
        cmd.cwd(cwd);

        // Inherit environment
        for (key, value) in std::env::vars() {
            cmd.env(key, value);
        }
        cmd.env("TERM", "xterm-256color");

        let _child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn command: {}", e))?;

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to get PTY writer: {}", e))?;

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to get PTY reader: {}", e))?;

        // Store session
        {
            let mut sessions = self.sessions.lock().unwrap();
            sessions.insert(
                session_id.to_string(),
                PtySession {
                    writer,
                    master: pair.master,
                },
            );
        }

        // Spawn reader thread
        let sid = session_id.to_string();
        thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        on_output(&sid, b""); // EOF
                        break;
                    }
                    Ok(n) => {
                        on_output(&sid, &buf[..n]);
                    }
                    Err(_) => {
                        on_output(&sid, b""); // Error → treat as exit
                        break;
                    }
                }
            }
        });

        Ok(())
    }

    /// Write input (keystrokes) to a PTY session.
    pub fn write(&self, session_id: &str, data: &[u8]) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("PTY session '{}' not found", session_id))?;
        session
            .writer
            .write_all(data)
            .map_err(|e| format!("Failed to write to PTY: {}", e))?;
        session
            .writer
            .flush()
            .map_err(|e| format!("Failed to flush PTY: {}", e))?;
        Ok(())
    }

    /// Resize a PTY session.
    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let sessions = self.sessions.lock().unwrap();
        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("PTY session '{}' not found", session_id))?;
        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to resize PTY: {}", e))
    }

    /// Close a PTY session and kill the process.
    pub fn close(&self, session_id: &str) {
        let mut sessions = self.sessions.lock().unwrap();
        sessions.remove(session_id);
    }
}

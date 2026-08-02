//! Terminal backend (spec §9) — real pseudo-terminals via `portable-pty`.
//!
//! Each open terminal spawns a shell behind a PTY. A reader thread streams the
//! shell's output to the frontend as `term:data:<id>` events; keystrokes and
//! resizes come back through commands. Multiple tabs = multiple sessions keyed
//! by id. In Phase 5 this same logic moves into the Agent for remote terminals.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use tauri::{AppHandle, Emitter, State};

struct Session {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    child: Box<dyn Child + Send + Sync>,
}

/// All live terminal sessions, keyed by the frontend-supplied id.
#[derive(Default)]
pub struct Terminals {
    inner: Mutex<HashMap<String, Session>>,
}

fn shell_path(shell: &str) -> &'static str {
    match shell {
        "cmd" => "cmd.exe",
        "pwsh" => "pwsh.exe",
        "wsl" => "wsl.exe",
        _ => "powershell.exe",
    }
}

fn pty_size(cols: u16, rows: u16) -> PtySize {
    PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    }
}

/// Open a new terminal: spawn `shell` behind a PTY and start streaming output.
#[tauri::command]
pub fn terminal_open(
    app: AppHandle,
    state: State<'_, Terminals>,
    id: String,
    shell: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let pair = native_pty_system()
        .openpty(pty_size(cols, rows))
        .map_err(|e| e.to_string())?;

    let mut cmd = CommandBuilder::new(shell_path(&shell));
    cmd.cwd(raspberry_core::home_dir());
    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    // The slave is no longer needed in this process once the child owns it.
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    // Reader thread: pump PTY output to the frontend until EOF.
    let app_evt = app.clone();
    let evt_id = id.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                    if app_evt.emit(&format!("term:data:{evt_id}"), chunk).is_err() {
                        break;
                    }
                }
            }
        }
        let _ = app_evt.emit(&format!("term:exit:{evt_id}"), ());
    });

    state.inner.lock().unwrap().insert(
        id,
        Session {
            writer,
            master: pair.master,
            child,
        },
    );
    Ok(())
}

/// Send keystrokes / pasted text to a terminal.
#[tauri::command]
pub fn terminal_write(state: State<'_, Terminals>, id: String, data: String) -> Result<(), String> {
    let mut map = state.inner.lock().unwrap();
    if let Some(s) = map.get_mut(&id) {
        s.writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
        s.writer.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Resize a terminal's PTY to match the xterm viewport.
#[tauri::command]
pub fn terminal_resize(
    state: State<'_, Terminals>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let map = state.inner.lock().unwrap();
    if let Some(s) = map.get(&id) {
        s.master
            .resize(pty_size(cols, rows))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Close a terminal and kill its shell.
#[tauri::command]
pub fn terminal_close(state: State<'_, Terminals>, id: String) {
    if let Some(mut s) = state.inner.lock().unwrap().remove(&id) {
        let _ = s.child.kill();
    }
}

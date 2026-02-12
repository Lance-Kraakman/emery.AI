//! Workspace Sync Commands (rsync over SSH)
//!
//! Provides Tauri commands for syncing agent workspaces between
//! local folders and EFS via native rsync with SSH key authentication.
//!
//! Features:
//! - Native rsync for efficient delta sync (only changed bytes transfer)
//! - SSH key authentication (Ed25519, cross-platform generation)
//! - Filesystem watcher for event-driven sync
//! - Workspace locking during agent tasks (via HTTP API)

use futures::StreamExt;
use notify::RecommendedWatcher;
use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use reqwest_eventsource::{Event, EventSource};
use serde::{Deserialize, Serialize};
use ssh_key::{Algorithm, LineEnding, PrivateKey};
use ssh_key::rand_core::OsRng;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_store::StoreExt;
use thiserror::Error;
use tokio::sync::{mpsc, oneshot};

const STORE_PATH: &str = "workspace-sync.json";
const API_KEY_STORE_KEY: &str = "api_key";
const SSH_KEY_NAME: &str = "emery_sync_ed25519";

// Lock file constants
const LOCK_FILE_NAME: &str = ".emery-lock";
const LOCK_TTL_SECS: i64 = 3600; // 1 hour - ignore stale locks

// Files/patterns to ignore in file watcher (system and editor files)
const IGNORED_PATTERNS: &[&str] = &[
    ".DS_Store",
    "Thumbs.db",
    ".git",
    ".gitignore",
    "*.swp",
    "*.swo",
    "*~",
    ".emery-lock",
    ".emery-sync-version",
    "desktop.ini",
    ".Spotlight-V100",
    ".Trashes",
    "__pycache__",
    "*.pyc",
    ".idea",
    ".vscode",
    "node_modules",
];

// ============================================================================
// Error Types
// ============================================================================

#[derive(Error, Debug)]
pub enum SyncError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("Store error: {0}")]
    Store(String),
    #[error("Dialog cancelled")]
    DialogCancelled,
    #[error("No API key configured")]
    NoApiKey,
    #[error("API error: {0}")]
    Api(String),
    #[error("SSH key error: {0}")]
    SshKey(String),
    #[error("rsync error: {0}")]
    Rsync(String),
    #[error("Workspace locked by task: {0}")]
    WorkspaceLocked(String),
    #[error("Not connected")]
    NotConnected,
}

impl From<SyncError> for String {
    fn from(e: SyncError) -> String {
        e.to_string()
    }
}

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfig {
    pub folder_path: String,
    pub last_sync: Option<i64>,
    /// SSH host (e.g., "localhost" for dev, "sync.yourapp.com" for prod)
    pub ssh_host: Option<String>,
    /// SSH port (default: 22, dev: 2222)
    pub ssh_port: Option<u16>,
    /// SSH username (e.g., "agent")
    pub ssh_user: Option<String>,
    /// Remote workspace path
    pub remote_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub connected: bool,
    pub locked: bool,
    pub locked_by_task: Option<String>,
    pub local_modified: Option<i64>,
    pub remote_modified: Option<i64>,
    pub pending_changes: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub files_synced: u32,
    pub bytes_transferred: u64,
    pub timestamp: i64,
    pub direction: String, // "push", "pull", "queued", or "none"
}

/// Workspace lock state (from .emery-lock file)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceLockState {
    pub locked: bool,
    pub task_id: Option<String>,
    pub started_at: Option<i64>,
    pub agent_id: Option<i64>,
}

/// Lock file contents (JSON structure in .emery-lock)
#[derive(Debug, Clone, Serialize, Deserialize)]
struct LockFileContents {
    task_id: String,
    started_at: i64,
    agent_id: i64,
}

/// SSH connection info for rsync
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshConnectionInfo {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub remote_path: String,
    pub key_path: PathBuf,
}

/// Pending change queued during workspace lock
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingChange {
    pub path: String,
    pub change_type: String, // "create", "modify", "delete"
    pub timestamp: i64,
}

// ============================================================================
// Connection State Manager
// ============================================================================

/// Manages connection state per agent (no actual connection needed for rsync)
pub struct ConnectionManager {
    connections: HashMap<i64, SshConnectionInfo>,
}

impl ConnectionManager {
    pub fn new() -> Self {
        Self {
            connections: HashMap::new(),
        }
    }

    pub fn set(&mut self, agent_id: i64, info: SshConnectionInfo) {
        self.connections.insert(agent_id, info);
    }

    pub fn get(&self, agent_id: i64) -> Option<&SshConnectionInfo> {
        self.connections.get(&agent_id)
    }

    pub fn remove(&mut self, agent_id: i64) {
        self.connections.remove(&agent_id);
    }

    pub fn is_connected(&self, agent_id: i64) -> bool {
        self.connections.contains_key(&agent_id)
    }
}

// Global connection manager
lazy_static::lazy_static! {
    static ref CONNECTION_MANAGER: Arc<Mutex<ConnectionManager>> =
        Arc::new(Mutex::new(ConnectionManager::new()));
}

// ============================================================================
// Filesystem Watcher Manager
// ============================================================================

pub struct WatcherManager {
    watchers: HashMap<i64, WatcherHandle>,
}

struct WatcherHandle {
    #[allow(dead_code)]
    watcher: notify_debouncer_mini::Debouncer<RecommendedWatcher>,
    path: PathBuf,
}

impl WatcherManager {
    pub fn new() -> Self {
        Self {
            watchers: HashMap::new(),
        }
    }

    pub fn is_watching(&self, agent_id: i64) -> bool {
        self.watchers.contains_key(&agent_id)
    }

    pub fn get_watched_path(&self, agent_id: i64) -> Option<PathBuf> {
        self.watchers.get(&agent_id).map(|h| h.path.clone())
    }

    pub fn stop(&mut self, agent_id: i64) {
        self.watchers.remove(&agent_id);
    }
}

lazy_static::lazy_static! {
    static ref WATCHER_MANAGER: Arc<Mutex<WatcherManager>> =
        Arc::new(Mutex::new(WatcherManager::new()));
}

// ============================================================================
// SSE Subscription Manager
// ============================================================================

/// Events emitted from SSE stream to frontend
#[derive(Debug, Clone, Serialize)]
pub struct AgentLockChangedEvent {
    pub agent_id: i64,
    pub locked: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentWorkspaceUpdatedEvent {
    pub agent_id: i64,
    pub version: String,
}

/// SSE connection handle with shutdown channel
struct SseHandle {
    shutdown_tx: mpsc::Sender<()>,
}

/// Manages SSE subscriptions per agent
pub struct SseManager {
    subscriptions: HashMap<i64, SseHandle>,
}

impl SseManager {
    pub fn new() -> Self {
        Self {
            subscriptions: HashMap::new(),
        }
    }

    pub fn is_subscribed(&self, agent_id: i64) -> bool {
        self.subscriptions.contains_key(&agent_id)
    }

    fn add(&mut self, agent_id: i64, handle: SseHandle) {
        self.subscriptions.insert(agent_id, handle);
    }

    fn remove(&mut self, agent_id: i64) -> Option<SseHandle> {
        self.subscriptions.remove(&agent_id)
    }
}

lazy_static::lazy_static! {
    static ref SSE_MANAGER: Arc<Mutex<SseManager>> =
        Arc::new(Mutex::new(SseManager::new()));
}

/// SSE event data from the server
#[derive(Debug, Deserialize)]
struct SseEventData {
    #[serde(rename = "type")]
    event_type: String,
    data: serde_json::Value,
}

// ============================================================================
// Helper Functions
// ============================================================================

fn get_store_key(agent_id: i64) -> String {
    format!("agent_{}", agent_id)
}

fn get_current_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn get_pending_changes_key(agent_id: i64) -> String {
    format!("agent_{}_pending", agent_id)
}

/// Check if a path should be ignored based on IGNORED_PATTERNS
fn should_ignore_path(path: &Path) -> bool {
    let path_str = path.to_string_lossy();
    let file_name = path.file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    for pattern in IGNORED_PATTERNS {
        // Handle glob-like patterns
        if pattern.starts_with('*') {
            // Suffix match (e.g., "*.swp")
            let suffix = &pattern[1..];
            if file_name.ends_with(suffix) || path_str.ends_with(suffix) {
                return true;
            }
        } else if pattern.ends_with('*') {
            // Prefix match
            let prefix = &pattern[..pattern.len() - 1];
            if file_name.starts_with(prefix) {
                return true;
            }
        } else {
            // Exact match or contains
            if file_name == *pattern || path_str.contains(pattern) {
                return true;
            }
        }
    }
    false
}

/// Get the path to rsync binary (bundled on Windows, system on Unix)
fn get_rsync_path() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        // Use bundled cwRsync on Windows
        if let Ok(exe) = std::env::current_exe() {
            if let Some(parent) = exe.parent() {
                let bundled = parent.join("resources").join("cwrsync").join("rsync.exe");
                if bundled.exists() {
                    return bundled;
                }
            }
        }
        // Fallback to PATH
        PathBuf::from("rsync.exe")
    }

    #[cfg(not(target_os = "windows"))]
    {
        PathBuf::from("rsync")
    }
}

/// Get the path to ssh binary (bundled on Windows, system on Unix)
fn get_ssh_path() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        // Use bundled ssh from cwRsync on Windows
        if let Ok(exe) = std::env::current_exe() {
            if let Some(parent) = exe.parent() {
                let bundled = parent.join("resources").join("cwrsync").join("ssh.exe");
                if bundled.exists() {
                    return bundled;
                }
            }
        }
        PathBuf::from("ssh.exe")
    }

    #[cfg(not(target_os = "windows"))]
    {
        PathBuf::from("ssh")
    }
}

// ============================================================================
// SSH Key Management
// ============================================================================

/// Get the SSH key directory
fn get_ssh_dir() -> Result<PathBuf, SyncError> {
    let home = dirs::home_dir().ok_or_else(|| SyncError::SshKey("No home directory".to_string()))?;
    Ok(home.join(".ssh"))
}

/// Get the path to the private SSH key
/// Generate Ed25519 SSH key pair if it doesn't exist (cross-platform, no external deps)
fn ensure_ssh_key() -> Result<PathBuf, SyncError> {
    let ssh_dir = get_ssh_dir()?;
    fs::create_dir_all(&ssh_dir).map_err(SyncError::Io)?;

    let key_path = ssh_dir.join(SSH_KEY_NAME);
    let pub_path = ssh_dir.join(format!("{}.pub", SSH_KEY_NAME));

    if !key_path.exists() {
        log::info!("Generating new SSH key pair at {:?}", key_path);

        // Generate Ed25519 key pair using pure Rust
        let private_key = PrivateKey::random(&mut OsRng, Algorithm::Ed25519)
            .map_err(|e| SyncError::SshKey(format!("Failed to generate key: {}", e)))?;

        // Write private key in OpenSSH format
        let private_openssh = private_key
            .to_openssh(LineEnding::LF)
            .map_err(|e| SyncError::SshKey(format!("Failed to encode private key: {}", e)))?;
        fs::write(&key_path, private_openssh.as_bytes()).map_err(SyncError::Io)?;

        // Write public key
        let public_openssh = private_key
            .public_key()
            .to_openssh()
            .map_err(|e| SyncError::SshKey(format!("Failed to encode public key: {}", e)))?;
        fs::write(&pub_path, public_openssh).map_err(SyncError::Io)?;

        // Set permissions to 600 (Unix only)
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&key_path, fs::Permissions::from_mode(0o600))
                .map_err(SyncError::Io)?;
        }

        log::info!("SSH key pair generated successfully");
    }

    Ok(key_path)
}

/// Read the public SSH key
fn read_public_key() -> Result<String, SyncError> {
    let ssh_dir = get_ssh_dir()?;
    let pub_path = ssh_dir.join(format!("{}.pub", SSH_KEY_NAME));
    fs::read_to_string(pub_path).map_err(SyncError::Io)
}

/// Register SSH public key with the server
async fn register_ssh_key(api_base: &str, api_key: &str, public_key: &str) -> Result<(), SyncError> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/user/ssh-keys", api_base);

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&serde_json::json!({
            "public_key": public_key,
            "name": "Emery Desktop Sync"
        }))
        .send()
        .await
        .map_err(SyncError::Http)?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        // 409 Conflict means key already registered - that's OK
        if status.as_u16() != 409 {
            return Err(SyncError::Api(format!("Failed to register SSH key: {} - {}", status, body)));
        }
    }

    Ok(())
}

// ============================================================================
// rsync Operations
// ============================================================================

/// Parse rsync output to extract stats
fn parse_rsync_output(output: &std::process::Output) -> Result<(u32, u64), SyncError> {
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !output.status.success() {
        return Err(SyncError::Rsync(format!(
            "rsync failed: {}",
            if stderr.is_empty() { &stdout } else { &stderr }
        )));
    }

    // Try to parse "sent X bytes" or "total size is X"
    let mut files_synced = 0u32;
    let mut bytes_transferred = 0u64;

    for line in stdout.lines() {
        if line.contains("files transferred:") || line.contains("files to consider:") {
            if let Some(num) = line.split_whitespace().next() {
                files_synced = num.parse().unwrap_or(0);
            }
        }
        if line.contains("sent") && line.contains("bytes") {
            // Parse "sent X bytes received Y bytes"
            let parts: Vec<&str> = line.split_whitespace().collect();
            if let Some(idx) = parts.iter().position(|&s| s == "sent") {
                if let Some(num_str) = parts.get(idx + 1) {
                    bytes_transferred = num_str.replace(",", "").parse().unwrap_or(0);
                }
            }
        }
    }

    Ok((files_synced, bytes_transferred))
}

/// Push local changes to remote using rsync
fn run_rsync_push(local_path: &Path, conn: &SshConnectionInfo) -> Result<(u32, u64), SyncError> {
    let rsync = get_rsync_path();
    let ssh = get_ssh_path();

    // Build SSH command with key and port
    let ssh_cmd = format!(
        "{} -i {} -p {} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null",
        ssh.display(),
        conn.key_path.display(),
        conn.port
    );

    // Build rsync command
    let remote = format!(
        "{}@{}:{}/",
        conn.username, conn.host, conn.remote_path
    );

    log::debug!("Running rsync push: {} -> {}", local_path.display(), remote);

    let output = Command::new(&rsync)
        .args([
            "-avz",                    // archive, verbose, compress
            "--delete",                // remove deleted files
            "--partial",               // keep partial transfers
            "--stats",                 // show transfer stats
            "-e", &ssh_cmd,            // SSH command with key
            "--exclude", ".DS_Store",
            "--exclude", "Thumbs.db",
            "--exclude", "*.swp",
            "--exclude", "*.swo",
            "--exclude", "*~",
            &format!("{}/", local_path.display()),
            &remote,
        ])
        .output()
        .map_err(SyncError::Io)?;

    parse_rsync_output(&output)
}

/// Pull remote changes to local using rsync
fn run_rsync_pull(local_path: &Path, conn: &SshConnectionInfo) -> Result<(u32, u64), SyncError> {
    let rsync = get_rsync_path();
    let ssh = get_ssh_path();

    // Build SSH command with key and port
    let ssh_cmd = format!(
        "{} -i {} -p {} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null",
        ssh.display(),
        conn.key_path.display(),
        conn.port
    );

    // Build rsync command
    let remote = format!(
        "{}@{}:{}/",
        conn.username, conn.host, conn.remote_path
    );

    log::debug!("Running rsync pull: {} -> {}", remote, local_path.display());

    let output = Command::new(&rsync)
        .args([
            "-avz",                    // archive, verbose, compress
            "--delete",                // remove deleted files
            "--partial",               // keep partial transfers
            "--stats",                 // show transfer stats
            "-e", &ssh_cmd,            // SSH command with key
            "--exclude", ".DS_Store",
            "--exclude", "Thumbs.db",
            "--exclude", "*.swp",
            "--exclude", "*.swo",
            "--exclude", "*~",
            &remote,
            &format!("{}/", local_path.display()),
        ])
        .output()
        .map_err(SyncError::Io)?;

    parse_rsync_output(&output)
}

// ============================================================================
// Tauri Commands - Configuration
// ============================================================================

/// Opens a native folder picker dialog and returns the selected path.
#[tauri::command]
pub async fn select_sync_folder(app: AppHandle) -> Result<String, String> {
    let (tx, rx) = oneshot::channel();

    app.dialog()
        .file()
        .set_title("Select Workspace Sync Folder")
        .pick_folder(move |folder| {
            let _ = tx.send(folder);
        });

    match rx.await {
        Ok(Some(path)) => Ok(path.to_string()),
        Ok(None) => Err(SyncError::DialogCancelled.into()),
        Err(_) => Err("Dialog channel closed".to_string()),
    }
}

/// Gets the sync configuration for an agent.
#[tauri::command]
pub async fn get_sync_config(app: AppHandle, agent_id: i64) -> Result<Option<SyncConfig>, String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| SyncError::Store(e.to_string()))?;

    let key = get_store_key(agent_id);
    let config = store
        .get(&key)
        .and_then(|v| serde_json::from_value::<SyncConfig>(v.clone()).ok());

    Ok(config)
}

/// Sets the sync configuration for an agent.
#[tauri::command]
pub async fn set_sync_config(
    app: AppHandle,
    agent_id: i64,
    folder_path: String,
) -> Result<(), String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| SyncError::Store(e.to_string()))?;

    let key = get_store_key(agent_id);
    let config = SyncConfig {
        folder_path,
        last_sync: None,
        ssh_host: None,
        ssh_port: None,
        ssh_user: None,
        remote_path: None,
    };

    store.set(
        key,
        serde_json::to_value(&config).map_err(|e| SyncError::Store(e.to_string()))?,
    );
    store.save().map_err(|e| SyncError::Store(e.to_string()))?;

    Ok(())
}

/// Stores the API key securely.
#[tauri::command]
pub async fn store_api_key(app: AppHandle, api_key: String) -> Result<(), String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| SyncError::Store(e.to_string()))?;

    store.set(
        API_KEY_STORE_KEY.to_string(),
        serde_json::Value::String(api_key),
    );
    store.save().map_err(|e| SyncError::Store(e.to_string()))?;

    Ok(())
}

/// Retrieves the stored API key.
#[tauri::command]
pub async fn get_api_key(app: AppHandle) -> Result<Option<String>, String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| SyncError::Store(e.to_string()))?;

    let api_key = store
        .get(API_KEY_STORE_KEY)
        .and_then(|v| v.as_str().map(String::from));

    Ok(api_key)
}

// ============================================================================
// Tauri Commands - SSH Connection
// ============================================================================

/// Determine if running in local development mode based on API base URL
fn is_local_dev(api_base: &str) -> bool {
    api_base.contains("localhost") || api_base.contains("127.0.0.1")
}

/// Get SSH connection info based on environment (no API call needed)
/// - Local dev: localhost:2222
/// - Production: ssh.enhancd.ai:22 (derived from API base or env var)
fn get_ssh_config(api_base: &str, org_id: i64, agent_id: i64, key_path: PathBuf) -> SshConnectionInfo {
    let ssh_root = std::env::var("SSH_WORKSPACE_ROOT")
        .or_else(|_| std::env::var("SFTP_WORKSPACE_ROOT"))
        .unwrap_or_else(|_| "/workspace".to_string());

    let (host, port) = if is_local_dev(api_base) {
        // Local development
        log::info!("Using local dev SSH settings (localhost:2222)");
        ("localhost".to_string(), 2222)
    } else {
        // Production: derive SSH host from API base or use env var
        // e.g., https://app.enhancd.ai -> ssh.enhancd.ai
        let ssh_host = std::env::var("EMERY_SSH_HOST").unwrap_or_else(|_| {
            api_base
                .replace("https://", "")
                .replace("http://", "")
                .replace("app.", "ssh.")
                .split('/')
                .next()
                .unwrap_or("ssh.enhancd.ai")
                .to_string()
        });
        let ssh_port = std::env::var("EMERY_SSH_PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(22);
        log::info!("Using production SSH settings ({}:{})", ssh_host, ssh_port);
        (ssh_host, ssh_port)
    };

    let remote_path = format!("{}/{}/agents/{}", ssh_root, org_id, agent_id);

    SshConnectionInfo {
        host,
        port,
        username: "agent".to_string(),
        remote_path,
        key_path,
    }
}

/// Set up SSH connection for an agent workspace (generates key, registers with server)
#[tauri::command]
pub async fn sftp_connect(
    _app: AppHandle,
    agent_id: i64,
    org_id: i64,
    api_key: String,
    api_base: String,
) -> Result<(), String> {
    // Ensure SSH key exists
    let key_path = ensure_ssh_key()?;

    // Read and register public key with server (idempotent)
    let public_key = read_public_key()?;
    if let Err(e) = register_ssh_key(&api_base, &api_key, &public_key).await {
        log::warn!("Failed to register SSH key (may already exist): {}", e);
        // Continue anyway - key might already be registered
    }

    // Get SSH connection info based on environment (no API call)
    let conn_info = get_ssh_config(&api_base, org_id, agent_id, key_path);

    log::info!(
        "SSH connection configured for agent {}, remote: {}@{}:{}{}",
        agent_id,
        conn_info.username,
        conn_info.host,
        conn_info.port,
        conn_info.remote_path
    );

    // Store connection info
    let mut manager = CONNECTION_MANAGER.lock().map_err(|e| e.to_string())?;
    manager.set(agent_id, conn_info);

    Ok(())
}

/// Disconnect (clear connection info)
#[tauri::command]
pub async fn sftp_disconnect(agent_id: i64) -> Result<(), String> {
    let mut manager = CONNECTION_MANAGER.lock().map_err(|e| e.to_string())?;
    manager.remove(agent_id);
    Ok(())
}

/// Check connection status
#[tauri::command]
pub async fn sftp_is_connected(agent_id: i64) -> Result<bool, String> {
    let manager = CONNECTION_MANAGER.lock().map_err(|e| e.to_string())?;
    Ok(manager.is_connected(agent_id))
}

// ============================================================================
// Tauri Commands - Workspace Lock (via HTTP API)
// ============================================================================

/// Check workspace lock status via HTTP API
#[tauri::command]
pub async fn check_workspace_lock(
    agent_id: i64,
    api_key: Option<String>,
    api_base: Option<String>,
) -> Result<WorkspaceLockState, String> {
    // If no API credentials, assume unlocked
    let (api_key, api_base) = match (api_key, api_base) {
        (Some(k), Some(b)) => (k, b),
        _ => {
            return Ok(WorkspaceLockState {
                locked: false,
                task_id: None,
                started_at: None,
                agent_id: None,
            });
        }
    };

    let client = reqwest::Client::new();
    let url = format!(
        "{}/api/agents/{}/workspace/file?path=/{}",
        api_base, agent_id, LOCK_FILE_NAME
    );

    match client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
    {
        Ok(response) => {
            if response.status() == reqwest::StatusCode::NOT_FOUND {
                // No lock file - unlocked
                return Ok(WorkspaceLockState {
                    locked: false,
                    task_id: None,
                    started_at: None,
                    agent_id: None,
                });
            }

            if !response.status().is_success() {
                // API error - assume unlocked
                return Ok(WorkspaceLockState {
                    locked: false,
                    task_id: None,
                    started_at: None,
                    agent_id: None,
                });
            }

            // Parse lock file contents
            #[derive(Deserialize)]
            struct FileResponse {
                #[allow(dead_code)]
                success: bool,
                data: Option<FileData>,
            }
            #[derive(Deserialize)]
            struct FileData {
                content: String,
            }

            match response.json::<FileResponse>().await {
                Ok(resp) => {
                    if let Some(data) = resp.data {
                        if let Ok(lock_data) = serde_json::from_str::<LockFileContents>(&data.content) {
                            // Check if lock is stale
                            let now = get_current_timestamp();
                            let age = now - lock_data.started_at;

                            if age > LOCK_TTL_SECS {
                                log::info!("Ignoring stale lock (age: {}s > {}s TTL)", age, LOCK_TTL_SECS);
                                return Ok(WorkspaceLockState {
                                    locked: false,
                                    task_id: Some(lock_data.task_id),
                                    started_at: Some(lock_data.started_at),
                                    agent_id: Some(lock_data.agent_id),
                                });
                            }

                            return Ok(WorkspaceLockState {
                                locked: true,
                                task_id: Some(lock_data.task_id),
                                started_at: Some(lock_data.started_at),
                                agent_id: Some(lock_data.agent_id),
                            });
                        }
                    }
                    Ok(WorkspaceLockState {
                        locked: false,
                        task_id: None,
                        started_at: None,
                        agent_id: None,
                    })
                }
                Err(_) => Ok(WorkspaceLockState {
                    locked: false,
                    task_id: None,
                    started_at: None,
                    agent_id: None,
                }),
            }
        }
        Err(_) => Ok(WorkspaceLockState {
            locked: false,
            task_id: None,
            started_at: None,
            agent_id: None,
        }),
    }
}

// ============================================================================
// Tauri Commands - Sync Status
// ============================================================================

/// Get comprehensive sync status
#[tauri::command]
pub async fn check_sync_status(
    app: AppHandle,
    agent_id: i64,
    api_key: String,
    api_base: String,
) -> Result<SyncStatus, String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| SyncError::Store(e.to_string()))?;

    let key = get_store_key(agent_id);
    let config: Option<SyncConfig> = store
        .get(&key)
        .and_then(|v| serde_json::from_value(v.clone()).ok());

    let config = config.ok_or_else(|| "No sync config found".to_string())?;
    let local_path = PathBuf::from(&config.folder_path);

    // Get local mtime
    let local_modified = local_path
        .metadata()
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64);

    // Check connection status
    let connected = {
        let manager = CONNECTION_MANAGER.lock().map_err(|e| e.to_string())?;
        manager.is_connected(agent_id)
    };

    // Check workspace lock via HTTP API
    let lock_state = check_workspace_lock(agent_id, Some(api_key), Some(api_base)).await?;

    // Get pending changes count
    let pending_key = get_pending_changes_key(agent_id);
    let pending_changes: Vec<PendingChange> = store
        .get(&pending_key)
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();

    Ok(SyncStatus {
        connected,
        locked: lock_state.locked,
        locked_by_task: lock_state.task_id,
        local_modified,
        remote_modified: None,
        pending_changes: pending_changes.len() as u32,
    })
}

// ============================================================================
// Tauri Commands - rsync Sync
// ============================================================================

/// Push local changes to remote using rsync
#[tauri::command]
pub async fn push_workspace(
    app: AppHandle,
    agent_id: i64,
    local_path: String,
    api_key: String,
    api_base: String,
) -> Result<SyncResult, String> {
    log::info!("push_workspace: agent_id={}, local_path={}", agent_id, local_path);

    let local_dir = PathBuf::from(&local_path);

    if !local_dir.exists() {
        log::error!("push_workspace: Local folder does not exist: {}", local_path);
        return Err(format!("Local folder does not exist: {}", local_path));
    }

    // Check workspace lock first
    let lock_state = check_workspace_lock(agent_id, Some(api_key.clone()), Some(api_base.clone())).await?;
    if lock_state.locked {
        log::info!("push_workspace: Workspace locked by task {:?}, queuing changes", lock_state.task_id);
        return queue_pending_changes(app, agent_id, local_path, "push").await;
    }

    // Get connection info
    let conn = {
        let manager = CONNECTION_MANAGER.lock().map_err(|e| e.to_string())?;
        manager.get(agent_id).cloned()
    };

    let conn = conn.ok_or_else(|| SyncError::NotConnected.to_string())?;

    // Run rsync
    let (files_synced, bytes_transferred) = run_rsync_push(&local_dir, &conn)?;

    // Clear pending changes
    let store = app
        .store(STORE_PATH)
        .map_err(|e| SyncError::Store(e.to_string()))?;

    let pending_key = get_pending_changes_key(agent_id);
    store.delete(&pending_key);
    store.save().map_err(|e| SyncError::Store(e.to_string()))?;

    // Update last sync time
    let timestamp = get_current_timestamp();
    let key = get_store_key(agent_id);
    let config = SyncConfig {
        folder_path: local_path,
        last_sync: Some(timestamp),
        ssh_host: Some(conn.host),
        ssh_port: Some(conn.port),
        ssh_user: Some(conn.username),
        remote_path: Some(conn.remote_path),
    };
    store.set(
        key,
        serde_json::to_value(&config).map_err(|e| SyncError::Store(e.to_string()))?,
    );
    store.save().map_err(|e| SyncError::Store(e.to_string()))?;

    Ok(SyncResult {
        files_synced,
        bytes_transferred,
        timestamp,
        direction: "push".to_string(),
    })
}

/// Pull remote changes to local using rsync
#[tauri::command]
pub async fn pull_workspace(
    app: AppHandle,
    agent_id: i64,
    local_path: String,
    _api_key: String,
    _api_base: String,
) -> Result<SyncResult, String> {
    log::info!("pull_workspace: agent_id={}, local_path={}", agent_id, local_path);

    let local_dir = PathBuf::from(&local_path);

    // Create directory if it doesn't exist
    fs::create_dir_all(&local_dir).map_err(SyncError::Io)?;

    // Get connection info
    let conn = {
        let manager = CONNECTION_MANAGER.lock().map_err(|e| e.to_string())?;
        manager.get(agent_id).cloned()
    };

    let conn = conn.ok_or_else(|| SyncError::NotConnected.to_string())?;

    // Run rsync
    let (files_synced, bytes_transferred) = run_rsync_pull(&local_dir, &conn)?;

    // Update last sync time
    let timestamp = get_current_timestamp();
    let store = app
        .store(STORE_PATH)
        .map_err(|e| SyncError::Store(e.to_string()))?;

    let key = get_store_key(agent_id);
    let config = SyncConfig {
        folder_path: local_path,
        last_sync: Some(timestamp),
        ssh_host: Some(conn.host),
        ssh_port: Some(conn.port),
        ssh_user: Some(conn.username),
        remote_path: Some(conn.remote_path),
    };
    store.set(
        key,
        serde_json::to_value(&config).map_err(|e| SyncError::Store(e.to_string()))?,
    );
    store.save().map_err(|e| SyncError::Store(e.to_string()))?;

    Ok(SyncResult {
        files_synced,
        bytes_transferred,
        timestamp,
        direction: "pull".to_string(),
    })
}

/// Queue pending changes when workspace is locked
async fn queue_pending_changes(
    app: AppHandle,
    agent_id: i64,
    local_path: String,
    change_type: &str,
) -> Result<SyncResult, String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| SyncError::Store(e.to_string()))?;

    let pending_key = get_pending_changes_key(agent_id);
    let mut pending: Vec<PendingChange> = store
        .get(&pending_key)
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();

    pending.push(PendingChange {
        path: local_path,
        change_type: change_type.to_string(),
        timestamp: get_current_timestamp(),
    });

    store.set(
        pending_key,
        serde_json::to_value(&pending).map_err(|e| SyncError::Store(e.to_string()))?,
    );
    store.save().map_err(|e| SyncError::Store(e.to_string()))?;

    Ok(SyncResult {
        files_synced: 0,
        bytes_transferred: 0,
        timestamp: get_current_timestamp(),
        direction: "queued".to_string(),
    })
}

/// Sync pending changes after workspace unlocks
#[tauri::command]
pub async fn sync_pending_changes(
    app: AppHandle,
    agent_id: i64,
    api_key: String,
    api_base: String,
) -> Result<SyncResult, String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| SyncError::Store(e.to_string()))?;

    let pending_key = get_pending_changes_key(agent_id);
    let pending: Vec<PendingChange> = store
        .get(&pending_key)
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();

    if pending.is_empty() {
        return Ok(SyncResult {
            files_synced: 0,
            bytes_transferred: 0,
            timestamp: get_current_timestamp(),
            direction: "none".to_string(),
        });
    }

    // Get sync config to find local path
    let key = get_store_key(agent_id);
    let config: SyncConfig = store
        .get(&key)
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .ok_or_else(|| "No sync config found".to_string())?;

    // Push the pending changes
    push_workspace(app, agent_id, config.folder_path, api_key, api_base).await
}

// ============================================================================
// Tauri Commands - Filesystem Watcher
// ============================================================================

/// Event emitted when files change in watched directory
#[derive(Debug, Clone, Serialize)]
pub struct FileChangeEvent {
    pub agent_id: i64,
    pub paths: Vec<String>,
    pub timestamp: i64,
}

/// Start watching a folder for changes
#[tauri::command]
pub async fn start_watching(
    app: AppHandle,
    agent_id: i64,
    local_path: String,
) -> Result<(), String> {
    let path = PathBuf::from(&local_path);

    if !path.exists() {
        return Err("Path does not exist".to_string());
    }

    let app_handle = app.clone();
    let watch_path = path.clone();

    // Create debounced watcher with 500ms delay
    let mut debouncer = new_debouncer(
        Duration::from_millis(500),
        move |res: Result<Vec<notify_debouncer_mini::DebouncedEvent>, notify::Error>| {
            match res {
                Ok(events) => {
                    // Filter out ignored files (e.g., .DS_Store, .git, etc.)
                    let changed_paths: Vec<String> = events
                        .iter()
                        .filter(|e| matches!(e.kind, DebouncedEventKind::Any))
                        .filter(|e| !should_ignore_path(&e.path))
                        .map(|e| e.path.to_string_lossy().to_string())
                        .collect();

                    if !changed_paths.is_empty() {
                        log::debug!(
                            "File watcher: {} relevant changes for agent {}",
                            changed_paths.len(),
                            agent_id
                        );
                        let event = FileChangeEvent {
                            agent_id,
                            paths: changed_paths,
                            timestamp: get_current_timestamp(),
                        };
                        let _ = app_handle.emit("workspace-file-change", event);
                    }
                }
                Err(e) => {
                    log::error!("Watch error for agent {}: {:?}", agent_id, e);
                }
            }
        },
    )
    .map_err(|e| format!("Failed to create watcher: {}", e))?;

    debouncer
        .watcher()
        .watch(&watch_path, notify::RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to start watching: {}", e))?;

    let mut manager = WATCHER_MANAGER.lock().map_err(|e| e.to_string())?;
    manager.stop(agent_id);
    manager.watchers.insert(
        agent_id,
        WatcherHandle {
            watcher: debouncer,
            path,
        },
    );

    Ok(())
}

/// Stop watching a folder
#[tauri::command]
pub async fn stop_watching(agent_id: i64) -> Result<(), String> {
    let mut manager = WATCHER_MANAGER.lock().map_err(|e| e.to_string())?;
    manager.stop(agent_id);
    Ok(())
}

/// Check if watching a folder
#[tauri::command]
pub async fn is_watching(agent_id: i64) -> Result<bool, String> {
    let manager = WATCHER_MANAGER.lock().map_err(|e| e.to_string())?;
    Ok(manager.is_watching(agent_id))
}

/// Get watched path for an agent
#[tauri::command]
pub async fn get_watched_path(agent_id: i64) -> Result<Option<String>, String> {
    let manager = WATCHER_MANAGER.lock().map_err(|e| e.to_string())?;
    Ok(manager
        .get_watched_path(agent_id)
        .map(|p| p.to_string_lossy().to_string()))
}

// ============================================================================
// Tauri Commands - SSE Subscription
// ============================================================================

/// Start SSE subscription for real-time agent updates
/// Replaces polling for lock state and workspace version changes
#[tauri::command]
pub async fn start_agent_sse(
    app: AppHandle,
    agent_id: i64,
    api_key: String,
    api_base: String,
) -> Result<(), String> {
    // Check if already subscribed
    {
        let manager = SSE_MANAGER.lock().map_err(|e| e.to_string())?;
        if manager.is_subscribed(agent_id) {
            log::info!("[SSE] Already subscribed to agent {}", agent_id);
            return Ok(());
        }
    }

    log::info!("[SSE] Starting subscription for agent {}", agent_id);

    // Create shutdown channel
    let (shutdown_tx, mut shutdown_rx) = mpsc::channel::<()>(1);

    // Store the handle
    {
        let mut manager = SSE_MANAGER.lock().map_err(|e| e.to_string())?;
        manager.add(agent_id, SseHandle { shutdown_tx });
    }

    // Clone app handle and api_key for the spawned task
    let app_handle = app.clone();
    let api_key_clone = api_key.clone();

    // Spawn the SSE connection task
    tokio::spawn(async move {
        let url = format!("{}/api/agents/{}/stream", api_base, agent_id);
        log::info!("[SSE] Connecting to {} with api_key prefix: {}", url, &api_key_clone[..api_key_clone.len().min(10)]);

        loop {
            // Create new EventSource with auth header
            let request = reqwest::Client::new()
                .get(&url)
                .header("Accept", "text/event-stream")
                .header("Authorization", format!("Bearer {}", api_key_clone));

            let mut es = EventSource::new(request).map_err(|e| {
                log::error!("[SSE] Failed to create EventSource: {}", e);
                e
            }).unwrap();

            loop {
                tokio::select! {
                    // Check for shutdown signal
                    _ = shutdown_rx.recv() => {
                        log::info!("[SSE] Received shutdown signal for agent {}", agent_id);
                        es.close();
                        return;
                    }
                    // Process SSE events
                    event = es.next() => {
                        match event {
                            Some(Ok(Event::Open)) => {
                                log::info!("[SSE] Connected to agent {} stream", agent_id);
                            }
                            Some(Ok(Event::Message(msg))) => {
                                // Parse the SSE event data
                                match serde_json::from_str::<SseEventData>(&msg.data) {
                                    Ok(event_data) => {
                                        match event_data.event_type.as_str() {
                                            "lock_changed" => {
                                                if let Some(locked) = event_data.data.get("locked").and_then(|v| v.as_bool()) {
                                                    log::debug!("[SSE] Lock changed for agent {}: {}", agent_id, locked);
                                                    let _ = app_handle.emit("agent-lock-changed", AgentLockChangedEvent {
                                                        agent_id,
                                                        locked,
                                                    });
                                                }
                                            }
                                            "workspace_updated" => {
                                                if let Some(version) = event_data.data.get("version").and_then(|v| v.as_str()) {
                                                    log::debug!("[SSE] Workspace updated for agent {}: {}", agent_id, version);
                                                    let _ = app_handle.emit("agent-workspace-updated", AgentWorkspaceUpdatedEvent {
                                                        agent_id,
                                                        version: version.to_string(),
                                                    });
                                                }
                                            }
                                            "tasks_snapshot" | "tasks_updated" => {
                                                // Tasks are handled by the web frontend, not Tauri
                                                // We only care about lock and workspace events here
                                            }
                                            _ => {
                                                log::debug!("[SSE] Unknown event type: {}", event_data.event_type);
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        log::warn!("[SSE] Failed to parse event data: {}", e);
                                    }
                                }
                            }
                            Some(Err(e)) => {
                                log::error!("[SSE] Connection error for agent {}: {:?}", agent_id, e);
                                // Break inner loop to reconnect
                                break;
                            }
                            None => {
                                log::info!("[SSE] Stream ended for agent {}, reconnecting...", agent_id);
                                break;
                            }
                        }
                    }
                }
            }

            // Wait before reconnecting
            log::info!("[SSE] Reconnecting to agent {} in 5 seconds...", agent_id);
            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    });

    Ok(())
}

/// Stop SSE subscription for an agent
#[tauri::command]
pub async fn stop_agent_sse(agent_id: i64) -> Result<(), String> {
    let handle = {
        let mut manager = SSE_MANAGER.lock().map_err(|e| e.to_string())?;
        manager.remove(agent_id)
    };

    if let Some(handle) = handle {
        log::info!("[SSE] Stopping subscription for agent {}", agent_id);
        // Send shutdown signal (ignore errors if receiver is dropped)
        let _ = handle.shutdown_tx.send(()).await;
    }

    Ok(())
}

/// Check if SSE subscription is active for an agent
#[tauri::command]
pub async fn is_agent_sse_connected(agent_id: i64) -> Result<bool, String> {
    let manager = SSE_MANAGER.lock().map_err(|e| e.to_string())?;
    Ok(manager.is_subscribed(agent_id))
}


//! Raspberry Remote Agent — HTTP wrapper around the shared `core` crate.
//!
//! Runs on a PC you want to observe. The Hub (elsewhere on your LAN) adds it
//! as a remote target via base URL + bearer token. Endpoints mirror the Tauri
//! commands the Hub already knows how to call, so any read-only panel that
//! works locally works remotely with no additional code.
//!
//! v0.1 scope: read-only endpoints (snapshot / process list / network / storage
//! / security / files / logs). No process kill, no WoL, no terminal — those are
//! deferred until we ship mTLS + explicit per-command allowlisting.

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use raspberry_core::{
    home_dir, list_dir, list_physical_disks, list_roots, network_info, packages_list_installed,
    packages_list_upgradable, packages_search, read_events, scan_lan, scan_lan_deep,
    security_snapshot, sysinfo_card, Monitor,
};
use serde::{Deserialize, Serialize};
use std::{
    net::SocketAddr,
    sync::{Arc, Mutex},
};
use tokio::signal;
use tower_http::{cors::CorsLayer, trace::TraceLayer};

mod config;

use config::AgentConfig;

const AGENT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Clone)]
struct AppState {
    monitor: Arc<Mutex<Monitor>>,
    token: Arc<String>,
    hostname: Arc<String>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info,tower_http=warn".to_string()),
        ))
        .init();

    let cfg = AgentConfig::load_or_create()?;
    let hostname = sysinfo::System::host_name().unwrap_or_else(|| "unknown-host".to_string());

    let state = AppState {
        monitor: Arc::new(Mutex::new(Monitor::new())),
        token: Arc::new(cfg.token.clone()),
        hostname: Arc::new(hostname.clone()),
    };

    let app = Router::new()
        // Public — used for pairing / status probes before a token is set.
        .route("/health", get(health))
        // Authenticated read-only endpoints.
        .route("/snapshot", get(snapshot))
        .route("/processes", get(processes))
        .route("/network_info", get(net_info))
        .route("/network_scan", get(net_scan))
        .route("/network_scan_deep", post(net_scan_deep))
        .route("/storage_disks", get(storage_disks))
        .route("/security_status", get(security_status))
        .route("/files_list", get(files_list))
        .route("/files_home", get(files_home))
        .route("/files_roots", get(files_roots))
        .route("/logs/:log/:max", get(logs_read))
        .route("/packages/list", get(packages_list))
        .route("/packages/upgradable", get(packages_upgradable))
        .route("/packages/search", get(packages_search_handler))
        .route("/sysinfo_card", get(sysinfo_card_handler))
        .with_state(state)
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive());

    let addr: SocketAddr = format!("0.0.0.0:{}", cfg.port).parse()?;
    tracing::info!("Raspberry Agent v{AGENT_VERSION} listening on {addr}");
    tracing::info!("  hostname : {hostname}");
    tracing::info!("  token    : {} (share with the Hub to pair)", cfg.token);
    tracing::info!("  config   : {}", cfg.path.display());
    tracing::info!("");
    tracing::info!("Hub setup: base URL http://<this-lan-ip>:{}", cfg.port);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };
    ctrl_c.await;
    tracing::info!("Shutting down.");
}

// --- Auth ------------------------------------------------------------------

/// Constant-time compare so a bad token can't be timed to reveal length/content.
fn ct_eq(a: &str, b: &str) -> bool {
    let a = a.as_bytes();
    let b = b.as_bytes();
    if a.len() != b.len() {
        return false;
    }
    let mut acc = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        acc |= x ^ y;
    }
    acc == 0
}

fn require_auth(state: &AppState, headers: &HeaderMap) -> Result<(), StatusCode> {
    let auth = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .ok_or(StatusCode::UNAUTHORIZED)?;
    if ct_eq(auth, state.token.as_str()) {
        Ok(())
    } else {
        Err(StatusCode::UNAUTHORIZED)
    }
}

// --- Handlers --------------------------------------------------------------

#[derive(Serialize)]
struct Health {
    hostname: String,
    version: &'static str,
    os: String,
    /// True on ping without a token — the Hub can display "reachable, unpaired".
    unauthenticated: bool,
}

async fn health(State(state): State<AppState>) -> impl IntoResponse {
    Json(Health {
        hostname: state.hostname.as_ref().clone(),
        version: AGENT_VERSION,
        os: sysinfo::System::long_os_version().unwrap_or_default(),
        unauthenticated: true,
    })
}

async fn snapshot(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, StatusCode> {
    require_auth(&state, &headers)?;
    let snap = state
        .monitor
        .lock()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .snapshot();
    Ok(Json(snap))
}

async fn processes(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, StatusCode> {
    require_auth(&state, &headers)?;
    let procs = state
        .monitor
        .lock()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .processes();
    Ok(Json(procs))
}

async fn net_info(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, StatusCode> {
    require_auth(&state, &headers)?;
    Ok(Json(network_info()))
}

async fn net_scan(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, StatusCode> {
    require_auth(&state, &headers)?;
    Ok(Json(scan_lan()))
}

async fn net_scan_deep(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, StatusCode> {
    require_auth(&state, &headers)?;
    let devices = tokio::task::spawn_blocking(scan_lan_deep)
        .await
        .unwrap_or_default();
    Ok(Json(devices))
}

async fn storage_disks(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, StatusCode> {
    require_auth(&state, &headers)?;
    Ok(Json(list_physical_disks()))
}

async fn security_status(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, StatusCode> {
    require_auth(&state, &headers)?;
    let snap = tokio::task::spawn_blocking(security_snapshot)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(snap))
}

#[derive(Deserialize)]
struct PathQuery {
    path: String,
}

async fn files_list(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(q): Query<PathQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    require_auth(&state, &headers)?;
    match list_dir(&q.path) {
        Ok(entries) => Ok(Json(entries)),
        Err(_) => Err(StatusCode::NOT_FOUND),
    }
}

async fn files_home(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, StatusCode> {
    require_auth(&state, &headers)?;
    Ok(Json(home_dir()))
}

async fn files_roots(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, StatusCode> {
    require_auth(&state, &headers)?;
    Ok(Json(list_roots()))
}

async fn logs_read(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((log, max)): Path<(String, u32)>,
) -> Result<impl IntoResponse, StatusCode> {
    require_auth(&state, &headers)?;
    let events = tokio::task::spawn_blocking(move || read_events(&log, max))
        .await
        .unwrap_or_default();
    Ok(Json(events))
}

// --- Read-only Packages + Sysinfo ------------------------------------------

async fn packages_list(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, StatusCode> {
    require_auth(&state, &headers)?;
    let list = tokio::task::spawn_blocking(packages_list_installed)
        .await
        .unwrap_or_else(|_| Ok(Vec::new()))
        .unwrap_or_default();
    Ok(Json(list))
}

async fn packages_upgradable(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, StatusCode> {
    require_auth(&state, &headers)?;
    let list = tokio::task::spawn_blocking(packages_list_upgradable)
        .await
        .unwrap_or_else(|_| Ok(Vec::new()))
        .unwrap_or_default();
    Ok(Json(list))
}

#[derive(Deserialize)]
struct SearchQuery {
    q: String,
}

async fn packages_search_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(q): Query<SearchQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    require_auth(&state, &headers)?;
    let list = tokio::task::spawn_blocking(move || packages_search(&q.q))
        .await
        .unwrap_or_else(|_| Ok(Vec::new()))
        .unwrap_or_default();
    Ok(Json(list))
}

async fn sysinfo_card_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, StatusCode> {
    require_auth(&state, &headers)?;
    let card = tokio::task::spawn_blocking(sysinfo_card)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(card))
}

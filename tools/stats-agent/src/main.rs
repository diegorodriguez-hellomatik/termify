// ============================================
// STATS-AGENT - Termify System Monitor
// ============================================
// Collects system stats and outputs as JSON
// Usage: stats-agent daemon [interval_secs]
// ============================================

use lazy_static::lazy_static;
use serde::Serialize;
use std::{
    env,
    io::{self, Write},
    sync::{Arc, Mutex},
    thread,
    time::Duration,
};
use sysinfo::{CpuRefreshKind, Disks, MemoryRefreshKind, Networks, Pid, ProcessRefreshKind, System};

// ============================================
// JSON Structures
// ============================================

#[derive(Serialize)]
struct Stats {
    cpu: Vec<f32>,
    cpu_avg: f32,
    memory: MemoryStats,
    disks: Vec<DiskStats>,
    network: Vec<NetStats>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    processes: Vec<ProcessStats>,
    #[serde(skip_serializing_if = "Option::is_none")]
    os: Option<OsInfo>,
}

#[derive(Serialize)]
struct MemoryStats {
    total: u64,
    used: u64,
    swap_total: u64,
    swap_used: u64,
}

#[derive(Serialize)]
struct DiskStats {
    name: String,
    available: u64,
    total: u64,
}

#[derive(Serialize)]
struct NetStats {
    interface: String,
    rx_bytes: u64,
    tx_bytes: u64,
    rx_packets: u64,
    tx_packets: u64,
    rx_errors: u64,
    tx_errors: u64,
}

#[derive(Serialize)]
struct ProcessStats {
    pid: u32,
    name: String,
    exe: String,
    memory: u64,
    cpu: f32,
}

#[derive(Serialize, Clone)]
struct OsInfo {
    name: String,
    kernel: String,
    version: String,
    arch: String,
}

// ============================================
// Shared System Instance
// ============================================

lazy_static! {
    static ref SYS: Arc<Mutex<System>> = Arc::new(Mutex::new(System::new()));
}

// ============================================
// Main
// ============================================

fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() > 1 {
        match args[1].as_str() {
            "daemon" => {
                // Optional interval (default 5 seconds)
                let interval = args.get(2).and_then(|s| s.parse().ok()).unwrap_or(5);
                daemon_mode(interval);
            }
            "json" => json_once(false),
            "json-processes" => json_once(true),
            "version" => {
                println!("stats-agent v{}", env!("CARGO_PKG_VERSION"));
            }
            _ => print_usage(),
        }
    } else {
        // Default: single JSON output
        json_once(false);
    }
}

fn print_usage() {
    eprintln!("Usage: stats-agent [command]");
    eprintln!();
    eprintln!("Commands:");
    eprintln!("  daemon [interval]  Run as daemon, output JSON every N seconds (default: 5)");
    eprintln!("  json               Output stats once as JSON");
    eprintln!("  json-processes     Output stats with top processes");
    eprintln!("  version            Show version");
    eprintln!();
    eprintln!("Without arguments, outputs stats once as JSON.");
}

// ============================================
// Daemon Mode - Continuous JSON output
// ============================================

fn daemon_mode(interval_secs: u64) {
    let interval = Duration::from_secs(interval_secs);

    // Get OS info once
    let os_info = get_os_info();

    // First CPU read (required for sysinfo to calculate usage correctly)
    {
        let mut sys = SYS.lock().unwrap();
        sys.refresh_cpu_specifics(CpuRefreshKind::everything());
    }
    thread::sleep(Duration::from_millis(500));

    // Include OS info only in first output
    let mut first = true;

    loop {
        let stats = collect_stats(if first { os_info.clone() } else { None }, false);
        first = false;

        match serde_json::to_string(&stats) {
            Ok(json) => {
                println!("{}", json);
                let _ = io::stdout().flush();
            }
            Err(e) => {
                eprintln!("Error serializing stats: {}", e);
            }
        }

        thread::sleep(interval);
    }
}

// ============================================
// Stats Collection
// ============================================

fn collect_stats(os_info: Option<OsInfo>, include_processes: bool) -> Stats {
    let mut sys = SYS.lock().unwrap();

    // Refresh data
    sys.refresh_memory_specifics(MemoryRefreshKind::new().with_ram().with_swap());
    sys.refresh_cpu_specifics(CpuRefreshKind::everything());

    // CPU per core
    let cpu: Vec<f32> = sys
        .cpus()
        .iter()
        .map(|c| (c.cpu_usage() * 100.0).round() / 100.0)
        .collect();

    let cpu_avg = if cpu.is_empty() {
        0.0
    } else {
        (cpu.iter().sum::<f32>() / cpu.len() as f32 * 100.0).round() / 100.0
    };

    // Memory
    let memory = MemoryStats {
        total: sys.total_memory(),
        used: sys.used_memory(),
        swap_total: sys.total_swap(),
        swap_used: sys.used_swap(),
    };

    // Processes (top 10 by CPU)
    let processes = if include_processes {
        sys.refresh_processes_specifics(
            sysinfo::ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::new().with_cpu().with_memory(),
        );

        let mut procs: Vec<_> = sys
            .processes()
            .iter()
            .map(|(pid, p)| ProcessStats {
                pid: pid.as_u32(),
                name: p.name().to_string_lossy().into_owned(),
                exe: p
                    .exe()
                    .map(|e| e.to_string_lossy().into_owned())
                    .unwrap_or_default(),
                memory: p.memory(),
                cpu: (p.cpu_usage() * 100.0).round() / 100.0,
            })
            .collect();

        procs.sort_by(|a, b| b.cpu.partial_cmp(&a.cpu).unwrap_or(std::cmp::Ordering::Equal));
        procs.truncate(10);
        procs
    } else {
        vec![]
    };

    // Release lock before slower operations
    drop(sys);

    // Disks
    let disks_info = Disks::new_with_refreshed_list();
    let disks: Vec<DiskStats> = disks_info
        .list()
        .iter()
        .filter(|d| d.total_space() > 0)
        .map(|d| DiskStats {
            name: d.name().to_string_lossy().into_owned(),
            available: d.available_space(),
            total: d.total_space(),
        })
        .collect();

    // Network
    let mut networks = Networks::new_with_refreshed_list();
    networks.refresh();

    let network: Vec<NetStats> = networks
        .iter()
        .filter(|(_, n)| n.total_received() > 0 || n.total_transmitted() > 0)
        .map(|(name, n)| NetStats {
            interface: name.clone(),
            rx_bytes: n.total_received(),
            tx_bytes: n.total_transmitted(),
            rx_packets: n.total_packets_received(),
            tx_packets: n.total_packets_transmitted(),
            rx_errors: n.total_errors_on_received(),
            tx_errors: n.total_errors_on_transmitted(),
        })
        .collect();

    Stats {
        cpu,
        cpu_avg,
        memory,
        disks,
        network,
        processes,
        os: os_info,
    }
}

fn get_os_info() -> Option<OsInfo> {
    let info = os_info::get();

    Some(OsInfo {
        name: System::name().unwrap_or_else(|| "Unknown".to_string()),
        kernel: System::kernel_version().unwrap_or_else(|| "Unknown".to_string()),
        version: System::os_version().unwrap_or_else(|| "Unknown".to_string()),
        arch: info
            .architecture()
            .map(|a| a.to_string())
            .unwrap_or_else(|| std::env::consts::ARCH.to_string()),
    })
}

// ============================================
// Single JSON Output
// ============================================

fn json_once(include_processes: bool) {
    // First CPU read
    {
        let mut sys = SYS.lock().unwrap();
        sys.refresh_cpu_specifics(CpuRefreshKind::everything());
    }
    thread::sleep(Duration::from_millis(500));

    let stats = collect_stats(get_os_info(), include_processes);

    match serde_json::to_string_pretty(&stats) {
        Ok(json) => println!("{}", json),
        Err(e) => eprintln!("Error: {}", e),
    }
}

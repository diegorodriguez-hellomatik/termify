# Stats Agent

System stats collector for Termify. Runs as a daemon and outputs JSON stats to stdout.

## Building

```bash
# Debug build
cargo build

# Release build (optimized, stripped)
cargo build --release
```

The binary will be at `target/release/stats-agent`.

## Cross-compilation

For different target architectures:

```bash
# Linux x86_64
rustup target add x86_64-unknown-linux-gnu
cargo build --release --target x86_64-unknown-linux-gnu

# Linux ARM64
rustup target add aarch64-unknown-linux-gnu
cargo build --release --target aarch64-unknown-linux-gnu

# macOS x86_64
rustup target add x86_64-apple-darwin
cargo build --release --target x86_64-apple-darwin

# macOS ARM64 (M1/M2)
rustup target add aarch64-apple-darwin
cargo build --release --target aarch64-apple-darwin
```

## Installation on Server

Copy the binary to the server:

```bash
scp target/release/stats-agent user@server:~/.termify/stats-agent
chmod +x ~/.termify/stats-agent
```

## Usage

```bash
# Run as daemon (outputs JSON every 5 seconds)
./stats-agent daemon

# Run as daemon with custom interval (e.g., 10 seconds)
./stats-agent daemon 10

# Single JSON output
./stats-agent json

# Single JSON output with top processes
./stats-agent json-processes

# Show version
./stats-agent version
```

## Output Format

```json
{
  "cpu": [12.5, 8.3, 15.2, 10.1],
  "cpu_avg": 11.52,
  "memory": {
    "total": 17179869184,
    "used": 8589934592,
    "swap_total": 4294967296,
    "swap_used": 0
  },
  "disks": [
    {
      "name": "disk0s1",
      "available": 107374182400,
      "total": 500107862016
    }
  ],
  "network": [
    {
      "interface": "en0",
      "rx_bytes": 1234567890,
      "tx_bytes": 987654321,
      "rx_packets": 1234567,
      "tx_packets": 654321,
      "rx_errors": 0,
      "tx_errors": 0
    }
  ],
  "os": {
    "name": "macOS",
    "kernel": "24.1.0",
    "version": "15.1",
    "arch": "aarch64"
  }
}
```

## Integration with Termify

Termify's `ServerStatsService` connects via SSH and runs:

```bash
~/.termify/stats-agent daemon 5
```

It reads stdout and parses each line as JSON stats.

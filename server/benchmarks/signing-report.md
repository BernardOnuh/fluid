# Signing Benchmark Report

Generated: 2026-03-25T10:28:49.971Z
Iterations: 5000
Warmup iterations: 500

| Implementation | Avg (ms) | P50 (ms) | P95 (ms) | Ops/sec | Relative to Node |
| --- | ---: | ---: | ---: | ---: | ---: |
| Node stellar-sdk | 0.0889 | 0.0761 | 0.1513 | 11248.98 | 1.00x |
| Rust ed25519-dalek | 0.1607 | 0.1519 | 0.1767 | 6223.41 | 0.55x |

Node min/max: 0.0647 ms / 4.3946 ms
Rust min/max: 0.1247 ms / 5.7594 ms

Methodology:
- Builds one unsigned fee-bump transaction per benchmark run.
- Signs the same transaction repeatedly after clearing signatures to isolate signing latency.
- Verifies parity first to ensure the Rust signer produces the same Ed25519 signature over the Stellar transaction hash as the current Node implementation.

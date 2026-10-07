# SAE INDIA RC-Bridge — Threat Model & Security Architecture

This document analyzes security risks, threat vectors, and engineering mitigations implemented in the RC-Bridge Control Layer.

---

## 1. Threat Vectors & Countermeasures

| Threat Vector | Severity | Attack Mechanism | Engineering Mitigation |
| :--- | :--- | :--- | :--- |
| **Command Replay Attack** | **CRITICAL** | Intercepting a valid `ARM` or `KILL` payload and re-transmitting it at an inopportune moment. | **Cryptographic Nonce Cache:** Every command requires a unique random `nonce`. Nonces are cached in memory for 5 minutes. Any duplicate nonce is rejected with HTTP `409 DUPLICATE_NONCE`. |
| **Stale Command Execution** | **HIGH** | Network congestion delays a `NUDGE` or `TAKEOFF` command for minutes, executing after context changes. | **Strict TTL Expiration:** Commands carry an `issuedAt` timestamp and `ttlMs` (e.g. 5000ms). If `now - issuedAt > ttlMs`, cloud and agent drop the command as `EXPIRED`. |
| **Token Leakage** | **HIGH** | Secret token exposed in code repository or browser client bundle. | **Zero Hardcoded Tokens:** All fallback tokens removed. Strictly loaded via `RELAY_AUTH_TOKEN` / `RELAY_TOKEN` environment variables. Netlify and Render store secrets in encrypted dashboard variables. |
| **Malicious Web / CORS Injection** | **MEDIUM** | Attacker website attempts to issue cross-origin flight commands. | **Restricted CORS & Authorization:** Only authorized origins are accepted. All endpoints require `Authorization: Bearer <token>`. Preflight `OPTIONS` requests are strictly handled. |
| **Laptop Agent Compromise / Hang** | **CRITICAL** | Laptop freezes, crashes, or internet disconnects mid-flight. | **Autonomous Link-Loss Failsafe:** If the agent loses cloud communication for $> 2\text{s}$, it freezes sticks neutral (`HOLD`). If lost for $> 5\text{s}$, it autonomously commands `RTL` (1685 us) and raises an audible alarm. |
| **Accidental Mid-Air Disarm** | **CRITICAL** | Operator accidentally presses Disarm button while UAV is 15m in the air. | **Airborne Safety Interlocks:** If relative altitude $> 0.4\text{m}$, disarm is rejected unless an explicit confirmation modal with warning dialog is completed. |
| **RF Interference / Jamming** | **HIGH** | 2.4 GHz / 915 MHz RF link jammed on the field. | **ArduPilot Hardware Failsafe:** Pixhawk detects receiver loss or throttle $< 975\text{us}$ and executes autonomous RTL independently of laptop or cloud. |

---

## 2. Safety Pilot Absolute Override Primacy

Regardless of software health, the **human safety pilot holds mechanical primacy**:
- Flipping switch `SA` on the physical EdgeTX radio disables trainer input and immediately hands 100% control back to the pilot's gimbals.
- Software injection is **never** the sole mechanism for control.

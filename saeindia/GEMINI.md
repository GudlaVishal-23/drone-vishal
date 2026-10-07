# SAE INDIA — Autonomous Drone Rescue & QR Mission System
## Agent Operating Directives & Project Rules

Welcome to the **SAE INDIA Drone Rescue & QR Mission** codebase (`saeindia`). This is a real-time, safety-critical avionics and Ground Control Station (GCS) project controlling autonomous multirotor UAVs in outdoor field competitions.

Any modification to this codebase directly impacts physical aircraft behavior, telemetry reliability, optical tracking, and competition score compliance.

---

### 1. Fundamental Safety Invariants (NON-NEGOTIABLE)

1. **Safety First, Always:**
   - Never disable or bypass safety checks (Pre-arm checklist, GPS satellite lock $\ge 6$, HDOP $\le 2.0$, EKF health, battery voltage $\ge 10.8\text{V}$ / $20\%$) in production flight modes.
   - Emergency Return-To-Launch (`RTL`) must remain triggerable instantly under all circumstances with zero UI latency or blocking modals.
   - Motor Disarm / Emergency Cut-off while airborne ($\text{altitude} > 0.4\text{m}$) must ALWAYS require high-severity operator confirmation to prevent accidental mid-air motor cutoff.

2. **Strict 3-Minute Mission Window:**
   - The mission timer is strictly bounded to 180 seconds (configurable up to 600s).
   - If time expires or remaining time is insufficient to complete Return-To-Launch, the system MUST autonomously initiate `EMERGENCY_RTL`.

3. **QR Code Integrity:**
   - Target payload format is strictly a **two-digit numeric string** matching the regex: `/^\d{2}$/`.
   - Never accept non-two-digit strings as verified competition targets.
   - Verification requires positive detection, immediate P2P dispatch to the field runner, and automatic reception of cryptographic confirmation ACK.

---

### 2. Multi-Role Architecture

The system operates under 5 distinct operational roles:

| Role | Callsign | Default Passkey | Purpose |
| :--- | :--- | :--- | :--- |
| **`GROUND_STATION`** | `GCS_ALPHA_01` | `gcs2026` | Mission planning, route setup, pre-arm validation, telemetry monitoring, Emergency RTL command. |
| **`DRONE`** | `DRONE_UAV_01` | `drone2026` | Onboard avionics core on airborne phone. Runs camera, box detection, QR decoding, Runner link, and Pixhawk RTL commands. |
| **`RUNNER`** | `RUNNER_FIELD_01` | `runner2026` | Zero-touch outdoor field display. Auto-receives target payload and returns immediate ACK handshake. |
| **`MANUAL`** | `MANUAL_OPS_01` | `manual2026` | Manual operator jogging controls (pitch, roll, yaw, altitude nudging) and emergency cutoff. |
| **`TESTBENCH`** | `TESTBENCH_OPERATOR` | Quick login | Side-by-side simulation bench running GCS, Drone, and Runner concurrently for full-sequence bench testing. |

---

### 3. Hardware & Communications Stack

1. **Pixhawk Flight Controller:**
   - Port: `TELEM2` (or Micro-USB via OTG)
   - Protocol: `SERIAL2_PROTOCOL = 2` (MAVLink 2)
   - Baud Rate: `SERIAL2_BAUD = 57` (57600 baud, 8N1)
2. **ESP32-S3 Bridge:**
   - Pinout: `GPIO 18` = RX (to Pixhawk TX), `GPIO 17` = TX (to Pixhawk RX), common `GND`.
   - Firmware: [`esp32_cloud_relay_client.ino`](file:///c:/Antigravityyyyy/Drone/saeindia/esp32-firmware/esp32_cloud_relay_client.ino)
   - Default SoftAP/Wi-Fi: `drone123` / `drone@123`
   - Direct LAN WebSocket: `ws://192.168.31.194:8080/ws`
3. **Cloud Relay:**
   - Production URL: `wss://saeindia-groundstation.onrender.com/ws` (or `wss://saeindia-szj0.onrender.com/ws`)
   - Secret Token: `saeindia_sec_99348a7b1c0e`
4. **Android Native USB-OTG:**
   - Native Plugin: `UsbSerialPlugin.java`
   - Interfaces: CDC-ACM, FTDI, CP210x, CH34x at 57600 baud.

---

### 4. Code Preservation & Development Guidelines

1. **Do NOT Break Flight Logic:**
   - Any refactoring must preserve all 53 flight states in [`src/types/mission.ts`](file:///c:/Antigravityyyyy/Drone/saeindia/src/types/mission.ts).
   - Never tamper with MAVLink v1/v2 frame serialization, CRC checksums, sequence incrementing, or heartbeat watchdog timers in [`src/services/mavlinkService.ts`](file:///c:/Antigravityyyyy/Drone/saeindia/src/services/mavlinkService.ts).
2. **Keep Offline & Mobile Resilience:**
   - The app must function in remote fields with zero internet connectivity using direct USB-OTG or local ESP32 Wi-Fi.
   - All critical state (Home Point, Mission state, duration limits) must persist to `localStorage`.
3. **Validation After Any Changes:**
   - Ensure clean TypeScript build: `npm run build`
   - Run end-to-end integration tests: `npm run test:e2e`

# SAE INDIA — Autonomous Drone Rescue & QR Mission System
## Agent Operating Directives & Project Rules

Welcome to the **SAE INDIA Drone Rescue & QR Mission** project located in `./saeindia`.
This workspace contains a real-time, safety-critical avionics and Ground Control Station (GCS) project for autonomous multirotor UAVs in outdoor field competitions.

---

### Core Directives for Any Agent Working in This Workspace:

1. **Safety First, Always:**
   - Never disable or bypass safety checks (Pre-arm checklist, GPS satellite lock $\ge 6$, HDOP $\le 2.0$, EKF health, battery voltage $\ge 10.8\text{V}$ / $20\%$) in production flight modes.
   - Emergency Return-To-Launch (`RTL`) must remain triggerable instantly under all circumstances.
   - Motor Disarm / Emergency Cut-off while airborne ($\text{altitude} > 0.4\text{m}$) must ALWAYS require high-severity operator confirmation.

2. **Strict 3-Minute Mission Window:**
   - The mission timer is strictly bounded to 180 seconds.
   - If time expires or remaining time is insufficient, autonomously initiate `EMERGENCY_RTL`.

3. **QR Code Integrity:**
   - Target payload format is strictly a **two-digit numeric string** matching the regex: `/^\d{2}$/`.
   - Verification requires positive detection, immediate P2P dispatch to the field runner, and automatic reception of confirmation ACK.

4. **Zero-Regression Code Preservation:**
   - Do NOT modify working flight algorithms, MAVLink frame parsing, or the 53-step mission state machine unless specifically instructed.
   - Always verify TypeScript build (`npm run build`) and E2E pipeline test (`npm run test:e2e`) inside `saeindia/`.

For complete architectural references, hardware pinouts, and flight state matrices, inspect [saeindia/MEMORY.md](file:///c:/Antigravityyyyy/Drone/saeindia/MEMORY.md).

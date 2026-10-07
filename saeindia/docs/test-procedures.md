# SAE INDIA RC-Bridge — Test Procedures & Flight Checklists

Follow this 3-tier testing procedure sequentially before any competitive outdoor flight.

---

## 🛑 Tier 1: Bench Test (Props-Off)

> **SAFETY MANDATE:** Remove all propellers from the drone motors before starting the bench test!

1. **Hardware Preparation:**
   - Connect Pixhawk to battery or bench power supply.
   - Connect Laptop USB-UART adapter to TX Trainer port or JR module bay.
   - Power on transmitter in Trainer Master mode.
2. **Launch Services:**
   ```bash
   # Terminal 1: Run Cloud Relay
   node relay-server/server.js

   # Terminal 2: Run Local Connector
   node local-connector/connector.js

   # Terminal 3: Run Laptop RC-Agent
   node local-agent/dist/index.js
   ```
3. **Verification in Mission Planner / QGroundControl:**
   - Open **Initial Setup $\rightarrow$ Mandatory Hardware $\rightarrow$ Radio Calibration**.
   - Issue commands from the Web GCS (`HOLD`, `RTL`, `NUDGE`, `ARM`):
     - Verify **CH5** moves to `1425 us` (Loiter), `1685 us` (RTL), `1815 us` (Land).
     - Verify **CH7** moves to `2000 us` on Arm and `1000 us` on Disarm.
     - Verify **CH1/CH2/CH4** deflect briefly on Nudge and return to `1500 us`.
4. **Safety Override Test:**
   - Command `RTL` from the web app.
   - Flip switch `SA` on the physical transmitter.
   - Move transmitter gimbals. Verify in Mission Planner that physical sticks immediately override injected values.
5. **Link-Loss Simulation:**
   - Disconnect laptop Wi-Fi/Ethernet.
   - Verify after 2 seconds: sticks freeze to neutral.
   - Verify after 5 seconds: CH5 automatically jumps to `1685 us` (RTL) and audible alarm sounds.

---

## 🪢 Tier 2: Tethered Flight Test

1. Secure drone to ground anchors with non-elastic tether lines allowing max 1.5m vertical travel.
2. Arm drone and command low hover in `ALT_HOLD` or `LOITER`.
3. Verify throttle response and attitude stabilization.
4. Test emergency `HOLD` command.
5. Test physical safety pilot override switch to confirm instant takeover.

---

## 🚀 Tier 3: Free Flight Test in Geofenced Field

1. Ensure 3D GPS lock with $\ge 8$ satellites and $\text{HDOP} \le 1.8$.
2. Verify Home point locked at launch pad.
3. Keep safety pilot eyes-on-drone at all times with fingers on override switch `SA` and Kill switch `SH`.
4. Execute autonomous takeoff, search corridor traversal, QR scan, and autonomous RTL within the 180s window.

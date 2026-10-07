# Rule 01: Flight Safety, Pre-Arm Verification & Failsafe Protocols

This rule governs all code dealing with aircraft arming, takeoff, flight control authority, safety watchdogs, and failsafes.

---

## 1. Pre-Arming Prerequisites

Under autonomous flight operations (`AUTONOMOUS`), motors must NEVER be armed unless ALL following conditions evaluate to `true` (unless the operator explicitly enables `forceBypassChecks` with documented warning logs):

1. **Flight Controller Link:** Pixhawk MAVLink heartbeat confirmed active within the last 2000ms (`heartbeatHz > 0.5`).
2. **GPS Fix Quality:**
   - Satellites locked $\ge 6$ (minimum).
   - Horizontal Dilution of Precision (`HDOP`) $\le 2.0$.
   - 3D Fix or DGPS/RTK confirmed.
3. **Home Point Validity:**
   - Home coordinate set with valid GPS latitude and longitude ($\text{lat} \ne 0, \text{lng} \ne 0$).
4. **Battery Health:**
   - Battery state-of-charge $> 25\%$ (warning at $25\%$, critical at $20\%$).
   - Battery voltage $> 10.8\text{V}$ for 3S LiPo or $> 14.4\text{V}$ for 4S LiPo.
5. **EKF & Sensors:**
   - EKF healthy flag active; Compass and Accelerometer status healthy.
6. **Subsystem Readiness:**
   - Camera ready and optical pipeline initialised.
   - P2P Runner link confirmed active.

---

## 2. Emergency Return-To-Launch (RTL) Interlocks

1. **Immediate Reaction:** When `triggerEmergencyRTL(reason)` is called:
   - Command flight mode `RTL` (ArduPilot mode 6) over MAVLink immediately.
   - Halt autonomous search patterns and clear pending waypoints.
   - Shift command authority to `'RTL'`.
   - Transition state to `'EMERGENCY_RTL'` or `'RETURNING_HOME'`.
   - Play high-urgency audible alert via `audioService`.
2. **Autonomous Failsafe Triggers:**
   - **Mission Timeout:** If remaining seconds reaches `0`, initiate `EMERGENCY_RTL`.
   - **Critical Battery:** If battery percent drops $\le 20\%$, initiate `EMERGENCY_RTL`.
   - **Heartbeat Loss:** If Pixhawk heartbeat ceases for $> 4500\text{ms}$ while airborne, engage link-loss failsafe.
   - **Runner ACK Timeout:** If QR code is dispatched to Runner but no ACK is received within 30 seconds, initiate `EMERGENCY_RTL`.

---

## 3. Disarm & Motor Kill Safeguards

1. **Airborne Disarm Protection:**
   - Never send an unconfirmed `MAV_CMD_COMPONENT_ARM_DISARM (param1 = 0)` while the drone is in flight (`altitude > 0.4m` or `isArmed = true`).
   - The UI must always display a high-visibility modal (`DisarmSafetyConfirmModal.tsx`) showing current altitude and requiring a deliberate two-step action.
2. **Emergency Motor Cut-Off:**
   - Emergency kill-switch command (`param2 = 21196` force disarm) is only permitted via explicit manual emergency override action.

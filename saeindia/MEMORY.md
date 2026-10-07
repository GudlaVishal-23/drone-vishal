# SAE INDIA Autonomous Drone Rescue & QR Mission System
# Long-Term Project Memory & Context Knowledge Base

This document serves as the persistent memory for any AI coding agent or engineer working on the **SAE INDIA Autonomous Drone Rescue & QR Mission System** (`saeindia`). It captures the operational domain knowledge, architectural decisions, hardware specifications, protocol schemas, and critical safety interlocks of this project.

---

## 1. Project Identity & Operational Objectives

- **Mission Name:** SAE INDIA Autonomous Drone Rescue & QR Mission
- **Application Type:** Real-time UAV Ground Control Station & Onboard Flight Intelligence System
- **Frameworks:** React 18, TypeScript, Vite 5, Tailwind CSS, Capacitor 6 (Android native runtime)
- **Target Hardware:** Multirotor Drone (Quad X / Quad Plus) equipped with Pixhawk 4 / Cube Orange running ArduPilot Copter ($\ge 4.0$), onboard Android Phone, ESP32-S3 wireless telemetry bridge, and field runner Android device.

### Primary Competition Mission Goals:
1. **Takeoff & Climb:** Autonomous arming, takeoff, and ascent to configured search altitude ($10\text{m} - 15\text{m}$).
2. **Autonomous Trajectory Search:** Traversal of a bounded geographic area (Rectangle, Polygon, Expanding Spiral, or Custom Waypoint Route).
3. **Target Acquisition:** Optical detection of a ground target box (kraft brown / white cuboid).
4. **Visual Servoing & QR Decode:** Center camera over target, descend if needed, execute multi-scale dynamic zoom sweeps, and decode a strictly two-digit numeric QR code (`/^\d{2}$/`).
5. **Direct Runner Relay:** Instantaneous P2P transmission of the verified code to the field runner unit located $10\text{m} - 15\text{m}$ away.
6. **Radio Handshake Confirmation:** Immediate receipt of zero-touch cryptographic acknowledgment (`QR_ACK`) from the runner.
7. **Autonomous RTL & Landing:** Immediate return to home coordinates and autonomous landing within the strict 3-minute mission window.

---

## 2. System Architecture & Topology

```
+-----------------------------------------------------------------------------------------+
|                                    DRONE HARDWARE                                       |
|                                                                                         |
|  +--------------------+        TELEM2 UART (57600 baud)        +---------------------+  |
|  | Pixhawk Autopilot  | <====================================> | ESP32-S3 Controller |  |
|  | (ArduPilot Copter) |                                        | (GPIO 18 RX/17 TX)  |  |
|  +--------------------+                                        +---------------------+  |
|           ^                                                                ||           |
|           | Direct USB-OTG (57600 baud)                                    || WSS TLS   |
|           v                                                                || (443)     |
|  +----------------------------------------------------+                    ||           |
|  | Airborne Android Phone (DRONE role)                |                    ||           |
|  | - CameraVisionHUD (Dynamic Zoom 1.0x-5.0x)         |                    ||           |
|  | - jsQR & Box Contour Detector                      |                    ||           |
|  | - UsbSerialPlugin.java (Native USB Host)           |                    ||           |
|  +----------------------------------------------------+                    ||           |
+--------------------------|-------------------------------------------------||-----------+
                           |                                                 ||
                           | P2P Radio Link (BroadcastChannel / Storage)     ||
                           v                                                 ||
+----------------------------------------------------+                       ||
| Field Runner Android Phone (RUNNER role)           |                       ||
| - Auto-ACK Instant Radio Handshake                 |                       ||
| - High-contrast Outdoor Screen Display             |                       ||
+----------------------------------------------------+                       ||
                                                                             ||
                                                                             v
+-----------------------------------------------------------------------------------------+
|                                 RELAY & GROUND STATION                                  |
|                                                                                         |
|  +-----------------------------------------------------------------------------------+  |
|  | Cloud WebSocket Relay (Render.com:8443)                                           |  |
|  | - Endpoints: /connector (Authenticated Drone), /ws (GCS Observers), /health       |  |
|  | - Multiplexes binary MAVLink packets & telemetry to all connected ground consoles |  |
|  +-----------------------------------------------------------------------------------+  |
|                                            ^                                            |
|                                            | WSS /ws                                    |
|                                            v                                            |
|  +-----------------------------------------------------------------------------------+  |
|  | Ground Station Console (GROUND_STATION role - PC / Tablet / Field Phone)          |  |
|  | - GoogleMapGroundStation (Leaflet High-Res Satellite Waypoint Drawer)              |  |
|  | - Tactical Pre-Arm Checks, Geofencing, Battery Watchdog, Emergency RTL            |  |
|  +-----------------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------------+
```

---

## 3. Communication Parameters & Environment Variables

| Parameter | Default Value | Notes |
| :--- | :--- | :--- |
| `VITE_ESP32_WS_URL` | `ws://192.168.31.194:8080/ws` | Local direct LAN WebSocket URL |
| `VITE_SECURE_RELAY_URL` | `wss://saeindia-relay-server.onrender.com/ws` | Production Render cloud relay |
| `VITE_RELAY_TOKEN` | `saeindia_sec_99348a7b1c0e` | Security token for relay authentication |
| `SERIAL2_BAUD` | `57` (57600 baud) | Mandatory Pixhawk TELEM2 baud rate |
| `SERIAL2_PROTOCOL` | `2` (MAVLink2) | Pixhawk MAVLink framing protocol |
| `ESP32 Wi-Fi SSID` | `drone123` | Default SoftAP / Hotspot network |
| `ESP32 Wi-Fi Pass` | `drone@123` | Default Wi-Fi password |

---

## 4. Role Accounts & Access Credentials

```typescript
GROUND_STATION: Callsign: 'GCS_ALPHA_01',    Passkey: 'gcs2026'
DRONE:          Callsign: 'DRONE_UAV_01',    Passkey: 'drone2026'
RUNNER:         Callsign: 'RUNNER_FIELD_01', Passkey: 'runner2026'
MANUAL:         Callsign: 'MANUAL_OPS_01',   Passkey: 'manual2026'
TESTBENCH:      Multi-role unified testing suite (No passkey required)
```

---

## 5. Core 53-Step Mission State Machine

The master state machine is defined in [`src/types/mission.ts`](file:///c:/Antigravityyyyy/Drone/saeindia/src/types/mission.ts) and executed in [`src/services/missionEngine.ts`](file:///c:/Antigravityyyyy/Drone/saeindia/src/services/missionEngine.ts):

1. **Pre-Flight Phases:** `IDLE` $\rightarrow$ `CONFIGURING` $\rightarrow$ `HOME_SET` $\rightarrow$ `READY` $\rightarrow$ `PLANNING` $\rightarrow$ `MISSION_VALIDATED`
2. **Launch & Climb:** `STARTING` $\rightarrow$ `TAKEOFF` $\rightarrow$ `CLIMBING` $\rightarrow$ `CLIMBING_TO_ALTITUDE` $\rightarrow$ `ALTITUDE_STABILIZING`
3. **Outbound Trajectory & Search:** `OUTBOUND_NAVIGATION` $\rightarrow$ `SEARCHING` $\rightarrow$ `OBJECT_DETECTED` $\rightarrow$ `BOX_DETECTED` $\rightarrow$ `BOX_TRACKING` $\rightarrow$ `BOX_CENTERED` $\rightarrow$ `INSPECTING`
4. **Target Acquisition & QR Processing:** `QR_DETECTION` $\rightarrow$ `QR_DETECTED` $\rightarrow$ `QR_SCANNING` $\rightarrow$ `QR_DECODED` $\rightarrow$ `DATA_CONFIRMED`
5. **Runner Handshake:** `SEND_TO_RUNNER` $\rightarrow$ `WAIT_FOR_RUNNER_ACK` $\rightarrow$ `RUNNER_CONFIRMED` $\rightarrow$ `MISSION_COMPLETE`
6. **Return & Recovery:** `RTL_REQUESTED` $\rightarrow$ `RTL` $\rightarrow$ `RETURNING_HOME` $\rightarrow$ `RETURN_NAVIGATION` $\rightarrow$ `HOME_REACHED` $\rightarrow$ `LANDING` $\rightarrow$ `LANDED`
7. **Emergency & Failsafe Exceptions:** `LOW_BATTERY`, `EMERGENCY_RTL`, `MISSION_TIMEOUT`, `CONNECTION_LOST`, `GPS_ERROR`, `CAMERA_ERROR`, `BOUNDARY_ERROR`, `FAILSAFE`, `ERROR`, `ABORTED`

---

## 6. Safety Interlocks & Watchdogs

1. **GCS Heartbeat Watchdog:**
   - Ground station transmits heartbeat every 1000ms.
   - Watchdog detects link loss if no heartbeat received from Pixhawk for $> 4500\text{ms}$.
2. **Battery Safeguard:**
   - $> 25\%$: Normal operations.
   - $\le 25\%$: Warning audio prompt.
   - $\le 20\%$: Involuntary autonomous `EMERGENCY_RTL`.
3. **Mission Duration Timeout:**
   - Master mission timer counts down from 180 seconds.
   - At 0 seconds, mission engine triggers `EMERGENCY_RTL`.
4. **Pre-Arm Interlocks:**
   - Pixhawk connected, GPS satellites $\ge 6$, HDOP $\le 2.0$, Home Point locked, Battery $> 25\%$, Camera active, Runner link online.
   - Can only be overridden if operator deliberately enables `forceBypassChecks`.
5. **Airborne Disarm Interlock:**
   - If altitude $> 0.4\text{m}$, UI disarm button triggers `DisarmSafetyConfirmModal` requiring double confirmation to prevent accidental motor shutdown in mid-air.

---

## 7. Known Hardware Gotchas & Operational Notes

- **ESP32-S3 USB CDC:** Arduino IDE must have `Tools -> USB CDC On Boot` set to **Enabled**; otherwise, no Serial monitor logs appear over USB.
- **Android USB Host Permissions:** Some Android vendors (OnePlus, Oppo, Vivo) automatically disable USB-OTG after 10 minutes of inactivity. It must be toggled ON in Android system settings.
- **Pixhawk Power Limits:** TELEM2 provides +5V at 2.5A to 3.0A when powered via drone LiPo battery through the power distribution board. However, if Pixhawk is powered only via USB cable on a workbench, current is capped at 500mA, which may cause brownouts on the ESP32 Wi-Fi module. Always use an external 5V UBEC or battery for Wi-Fi transmission.
- **Camera Zoom:** On phones lacking hardware optical zoom APIs, the `visionService` uses canvas multi-scale digital zoom with bicubic interpolation.

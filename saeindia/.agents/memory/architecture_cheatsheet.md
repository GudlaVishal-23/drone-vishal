# Architecture & Codebase Cheatsheet

### Core Service Architecture Matrix

| Service | File | Lines / Size | Key Responsibilities |
| :--- | :--- | :--- | :--- |
| `mavlinkService` | [`src/services/mavlinkService.ts`](file:///c:/Antigravityyyyy/Drone/saeindia/src/services/mavlinkService.ts) | 2,475 lines (102 KB) | Ring buffer MAVLink 1/2 parsing, heartbeat watchdog, command ACKs, waypoint upload, arm/disarm, mode setting. |
| `missionEngine` | [`src/services/missionEngine.ts`](file:///c:/Antigravityyyyy/Drone/saeindia/src/services/missionEngine.ts) | 1,151 lines (45 KB) | 53-step flight state machine, 180s mission timer countdown, pre-flight checks, failsafe triggers, state persistence. |
| `visionService` | [`src/services/visionService.ts`](file:///c:/Antigravityyyyy/Drone/saeindia/src/services/visionService.ts) | 818 lines (27.8 KB) | Camera stream, dynamic 2s zoom sweep (1.0x-5.0x), `jsQR` optical scanning, 10s photo capture/purge, `/^\d{2}$/` regex. |
| `boxDetectionService` | [`src/services/boxDetectionService.ts`](file:///c:/Antigravityyyyy/Drone/saeindia/src/services/boxDetectionService.ts) | 430 lines (14.6 KB) | Kraft brown / white top-face cuboid detector, EMA smoothing ($\alpha=0.5$), visual servoing speed guidance. |
| `groundStationMissionService` | [`src/services/groundStationMissionService.ts`](file:///c:/Antigravityyyyy/Drone/saeindia/src/services/groundStationMissionService.ts) | 804 lines (27.5 KB) | Haversine distance, initial bearing, destination computation, spherical polygon area, survey grid generator. |
| `customRouteService` | [`src/services/customRouteService.ts`](file:///c:/Antigravityyyyy/Drone/saeindia/src/services/customRouteService.ts) | 703 lines (25.8 KB) | Waypoint sequence generator, outbound & return leg manager, reverse path (`SAME_PATH_BACK`), progress tracker. |
| `searchEngine` | [`src/services/searchEngine/SearchEngine.ts`](file:///c:/Antigravityyyyy/Drone/saeindia/src/services/searchEngine/SearchEngine.ts) | 488 lines (17.6 KB) | Pluggable search algorithms (Grid, Expanding Spiral, Perimeter, Adaptive) with ground camera footprint calculations. |
| `TransportManager` | [`src/services/transports/TransportManager.ts`](file:///c:/Antigravityyyyy/Drone/saeindia/src/services/transports/TransportManager.ts) | 153 lines (5.3 KB) | Auto-selection of Android USB, ESP32 WebSocket, WebSerial, WebUSB, UDP, or Simulator transports. |
| `runnerCommService` | [`src/services/runnerCommService.ts`](file:///c:/Antigravityyyyy/Drone/saeindia/src/services/runnerCommService.ts) | 213 lines (6.4 KB) | P2P radio broadcast link between Drone and Runner phones, ACK handshake, latency tracking. |
| `authService` | [`src/services/authService.ts`](file:///c:/Antigravityyyyy/Drone/saeindia/src/services/authService.ts) | 158 lines (4.4 KB) | Role access credentials, passkey verification, session storage persistence. |
| `storageService` | [`src/services/storageService.ts`](file:///c:/Antigravityyyyy/Drone/saeindia/src/services/storageService.ts) | 140 lines (4.4 KB) | Blackbox mission flight logs, JSON and CSV telemetry export, log clearing. |
| `audioService` | [`src/services/audioService.ts`](file:///c:/Antigravityyyyy/Drone/saeindia/src/services/audioService.ts) | 127 lines (3.7 KB) | Web Audio synthesizer beeps, target lock alerts, QR confirmation chimes, emergency audio warnings. |

---

### Component Hierarchy

```
App.tsx
├── Header.tsx (Role badge, Mission Timer, Battery, GPS Sats, Mute, History, GoogleMaps link)
├── LoginScreen.tsx (Role selection & Passkey auth)
├── GroundStationDashboard.tsx (When role == GROUND_STATION)
│   ├── GroundStationOperationsBar.tsx
│   ├── CompactHomePointCard.tsx
│   ├── FlightControllerCard.tsx
│   ├── MissionConfigurationCard.tsx
│   ├── RouteSummaryCard.tsx
│   ├── ReturnBehaviorCard.tsx
│   ├── PreArmDropdownCard.tsx
│   ├── MissionStatusCard.tsx
│   ├── MissionSafetyCard.tsx
│   ├── VisionStatusCard.tsx
│   ├── GoogleMapGroundStation.tsx (Leaflet Satellite Map)
│   ├── LiveVideoFeed.tsx (PiP camera feed)
│   └── CollapsibleEventLog.tsx
├── DroneDashboard.tsx (When role == DRONE)
│   ├── AutonomousMissionStatusBar.tsx
│   ├── CameraVisionHUD.tsx (Viewfinder, filters, reticle)
│   ├── QRResultCard.tsx (Decoded payload display)
│   ├── PixhawkConnectionCard.tsx (Link connection controls)
│   ├── BatteryMonitorCard.tsx
│   └── SerialDiagnosticsModal.tsx
├── RunnerDashboard.tsx (When role == RUNNER)
│   ├── Large Numeric Code Display (with celebratory confetti)
│   └── AckProtocolCard.tsx (Instant radio handshake status)
├── MultiRoleSimBench.tsx (When role == TESTBENCH)
│   └── Side-by-side GroundStation, Drone & Runner simulators
└── MissionHistoryModal.tsx (Export JSON / CSV logs)
```

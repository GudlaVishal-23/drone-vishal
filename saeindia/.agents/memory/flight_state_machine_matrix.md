# Complete 53-Step Flight State Machine Reference

The autonomous flight engine ([`src/services/missionEngine.ts`](file:///c:/Antigravityyyyy/Drone/saeindia/src/services/missionEngine.ts)) coordinates all operational flight phases across 53 explicit states:

```
[IDLE] 
  │
  ├──> [CONFIGURING] ──> [HOME_SET] ──> [READY] ──> [PLANNING] ──> [MISSION_VALIDATED]
  │                                                                       │
  │   ┌───────────────────────────────────────────────────────────────────┘
  │   ▼
  ├──> [STARTING] ──> [TAKEOFF] ──> [CLIMBING] ──> [CLIMBING_TO_ALTITUDE]
  │                                                        │
  │   ┌────────────────────────────────────────────────────┘
  │   ▼
  ├──> [ALTITUDE_STABILIZING] ──> [ALTITUDE_UPDATING]
  │                                       │
  │   ┌───────────────────────────────────┘
  │   ▼
  ├──> [OUTBOUND_NAVIGATION] ──> [SEARCHING]
  │                                   │
  │   ┌───────────────────────────────┘
  │   ▼
  ├──> [OBJECT_DETECTED] ──> [BOX_DETECTED] ──> [BOX_TRACKING] ──> [BOX_CENTERED]
  │                                                                      │
  │   ┌──────────────────────────────────────────────────────────────────┘
  │   ▼
  ├──> [INSPECTING] ──> [TARGET_INVESTIGATION] ──> [OUTBOUND_COMPLETE]
  │                                                        │
  │   ┌────────────────────────────────────────────────────┘
  │   ▼
  ├──> [QR_DETECTION] ──> [QR_DETECTED] ──> [QR_SCANNING] ──> [QR_DECODED]
  │                                                                  │
  │   ┌──────────────────────────────────────────────────────────────┘
  │   ▼
  ├──> [DATA_CONFIRMED] ──> [SEND_TO_RUNNER] ──> [WAIT_FOR_RUNNER_ACK]
  │                                                      │
  │   ┌──────────────────────────────────────────────────┘
  │   ▼
  ├──> [RUNNER_CONFIRMED] ──> [MISSION_COMPLETE]
  │                                   │
  │   ┌───────────────────────────────┘
  │   ▼
  ├──> [RTL_REQUESTED] ──> [RTL] ──> [RETURNING_HOME] ──> [RETURN_NAVIGATION]
  │                                                                 │
  │   ┌─────────────────────────────────────────────────────────────┘
  │   ▼
  ├──> [HOME_REACHED] ──> [LANDING] ──> [LANDED]
  │
  └──> FAULT STATES (Interrupts any phase):
       [LOW_BATTERY] | [EMERGENCY_RTL] | [MISSION_TIMEOUT] | [CONNECTION_LOST] |
       [GPS_ERROR]   | [CAMERA_ERROR]  | [BOUNDARY_ERROR]  | [MANUAL_CONTROL]   |
       [FAILSAFE]    | [ERROR]         | [ABORTED]
```

### State Definitions & Trigger Criteria

1. **`IDLE`**: Default standby state prior to operator action. Telemetry monitoring is active.
2. **`CONFIGURING`**: Operator adjusting search boundary, altitudes, or speeds in mission modal.
3. **`HOME_SET`**: Valid GPS Home point locked and confirmed by Pixhawk.
4. **`READY`**: All pre-flight checklist conditions satisfied. Start button active.
5. **`PLANNING`**: Trajectory generator producing search transects or waypoints.
6. **`MISSION_VALIDATED`**: Pre-flight conditions confirmed safe for takeoff.
7. **`STARTING`**: Arming command dispatched to Pixhawk (`MAV_CMD_COMPONENT_ARM_DISARM`).
8. **`TAKEOFF`**: Takeoff command dispatched (`MAV_CMD_NAV_TAKEOFF`).
9. **`CLIMBING` / `CLIMBING_TO_ALTITUDE`**: Ascending towards configured target altitude ($10\text{m} - 15\text{m}$).
10. **`ALTITUDE_STABILIZING`**: Holding altitude for stabilization window ($2\text{s}$) to allow EKF velocity stabilization.
11. **`OUTBOUND_NAVIGATION`**: Navigating from Home reference to initial search waypoint.
12. **`SEARCHING`**: Executing active trajectory lanes (Grid, Spiral, Perimeter, Adaptive).
13. **`OBJECT_DETECTED` / `BOX_DETECTED`**: Optical detector identified candidate target cuboid.
14. **`BOX_TRACKING` / `BOX_CENTERED`**: Visual servoing active, centering camera axis over target.
15. **`INSPECTING`**: Hovering above target during high-resolution optical inspection window ($4\text{s}$).
16. **`QR_DETECTION` / `QR_DETECTED` / `QR_SCANNING` / `QR_DECODED`**: Optical decoding pipeline processing frames.
17. **`DATA_CONFIRMED`**: Decoded string confirmed valid against `/^\d{2}$/` regex.
18. **`SEND_TO_RUNNER`**: Target payload dispatched across P2P radio link.
19. **`WAIT_FOR_RUNNER_ACK`**: Awaiting cryptographic confirmation ACK from runner device (30s timeout).
20. **`RUNNER_CONFIRMED`**: ACK received with verified latency ($\le 300\text{ms}$).
21. **`MISSION_COMPLETE`**: Primary rescue goals achieved.
22. **`RTL_REQUESTED` / `RTL` / `RETURNING_HOME` / `RETURN_NAVIGATION`**: Pixhawk commanded to RTL mode; navigating home.
23. **`HOME_REACHED`**: Aircraft located within $2.0\text{m}$ radius of home coordinate.
24. **`LANDING` / `LANDED`**: Descending and motors disarmed after ground contact.
25. **`EMERGENCY_RTL`**: Failsafe invoked due to battery, timeout, or manual operator abort.

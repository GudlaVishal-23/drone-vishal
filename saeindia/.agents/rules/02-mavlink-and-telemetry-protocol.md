# Rule 02: MAVLink Telemetry Protocol & Transport Integrity

This rule defines standards and restrictions for MAVLink protocol parsing, frame construction, transport selection, and serial bridge operations.

---

## 1. MAVLink Protocol Versions & Packet Framing

1. **Dual Protocol Parsing:**
   - The parser must support both **MAVLink v1** (Magic Header `0xFE`, 8-byte header overhead) and **MAVLink v2** (Magic Header `0xFD`, 10-byte header overhead with optional signature).
   - Do NOT alter the CRC-16 (X.25 / MAVLink CRC Extra) seed calculations. Every message ID has a distinct CRC Extra seed required for packet validity.
2. **Critical Message IDs & Frequencies:**
   - `HEARTBEAT` (`msgId = 0`): Transmitted at 1 Hz by both flight controller and Ground Control Station (`MAV_TYPE_GCS = 6`).
   - `SYS_STATUS` (`msgId = 1`): Battery voltage, current, remaining percentage, and sensor drop rates.
   - `GPS_RAW_INT` (`msgId = 24`): Fix type, latitude (`deg * 1e7`), longitude (`deg * 1e7`), altitude (`mm`), HDOP (`cm`), visible satellites.
   - `ATTITUDE` (`msgId = 30`): Roll, pitch, yaw radians and angular velocities.
   - `GLOBAL_POSITION_INT` (`msgId = 33`): Relative altitude above home (`mm`), ground speed (`cm/s`), vertical climb rate (`cm/s`), compass heading (`cdeg`).
   - `BATTERY_STATUS` (`msgId = 147`): Individual cell voltages, current, temperature.
   - `STATUSTEXT` (`msgId = 253`): Pixhawk text notifications and pre-arm diagnostic failure strings.
   - `COMMAND_ACK` (`msgId = 77`): Confirmation response for arming, mode change, and guided waypoint commands.

---

## 2. ArduPilot Copter Flight Mode Mapping

Always respect the canonical ArduPilot Copter custom mode IDs:

```typescript
0: 'STABILIZE',
1: 'ACRO',
2: 'ALT_HOLD',
3: 'AUTO',
4: 'GUIDED',
5: 'LOITER',
6: 'RTL',
7: 'CIRCLE',
8: 'POSITION',
9: 'LAND'
```

When switching modes, send `MAV_CMD_DO_SET_MODE` (`176`) or MAVLink `SET_MODE` (`11`) with base mode `MAV_MODE_FLAG_CUSTOM_MODE_ENABLED` (`1`).

---

## 3. Serial Port & Baud Rates

- Hardware serial baud rate between Pixhawk TELEM2 and ESP32 / Android USB Host MUST be set to **`57600 baud`** (8 data bits, no parity, 1 stop bit).
- Do not modify default baud rate to 115200 or 9600 unless explicitly reconfigured in Mission Planner (`SERIAL2_BAUD = 57`).
- Native Android USB connections must request explicit USB Host permissions before attempting to open the interface.

---

## 4. GCS Heartbeat Emission

- The GCS MUST transmit a MAVLink Heartbeat (`MAV_TYPE_GCS`, `MAV_AUTOPILOT_INVALID`) once every 1000ms.
- Failure to emit this heartbeat causes ArduPilot's GCS failsafe to engage (`FS_GCS_ENABLE`), forcing unintentional return or landing.

---
name: mavlink-diagnostics
description: >-
  Systematic diagnostic procedures for Pixhawk telemetry, ESP32 bridges, and USB-OTG links.
---

# Pixhawk & MAVLink Diagnostics

1. Check physical baud rate: Pixhawk TELEM2 must be `57600 baud` (`SERIAL2_BAUD = 57`).
2. Protocol: `SERIAL2_PROTOCOL = 2` (MAVLink 2).
3. ESP32 Pinout: `GPIO 18` = RX, `GPIO 17` = TX, Common GND.
4. GCS Heartbeat: Must be emitted at 1 Hz (`MAV_TYPE_GCS = 6`).

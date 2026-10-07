---
name: saeindia-mavlink-diagnostics
description: >-
  Provides systematic diagnostic procedures and troubleshooting steps for Pixhawk
  flight controller connections, MAVLink stream errors, ESP32 Wi-Fi bridges,
  and native Android USB-OTG links. Use when telemetry is disconnected or failing.
---

# SAE INDIA Pixhawk & MAVLink Diagnostics Guide

Use this skill when diagnosing connection issues, packet dropouts, or communication failures between the Ground Station, Drone Android device, and the Pixhawk flight controller.

---

## 1. Connection Architecture Checklist

Identify the active connection transport being used:

1. **Direct USB-OTG (Android Phone $\longleftrightarrow$ Pixhawk Micro-USB):**
   - Driven by [`UsbSerialPlugin.java`](file:///c:/Antigravityyyyy/Drone/saeindia/android/app/src/main/java/org/saeindia/dronerescue/UsbSerialPlugin.java).
   - Check if Android USB Host permission prompt appeared and was accepted.
   - Verify phone OTG setting is enabled in Android settings (some devices like OnePlus/Realme require "OTG Connection" enabled manually).
2. **ESP32-S3 Wi-Fi Bridge (Pixhawk TELEM2 $\longleftrightarrow$ ESP32 $\longleftrightarrow$ Cloud Relay):**
   - Driven by [`esp32_cloud_relay_client.ino`](file:///c:/Antigravityyyyy/Drone/saeindia/esp32-firmware/esp32_cloud_relay_client.ino).
   - Check ESP32 Serial Monitor @ 115200 baud (with USB CDC On Boot enabled in Arduino IDE).
   - Verify Wi-Fi SSID and password match hotspot credentials (`WIFI_SSID = "drone123"`, `WIFI_PASSWORD = "drone@123"`).
3. **Local WebSocket Bridge (LAN):**
   - Local IP URL: `ws://192.168.31.194:8080/ws`.

---

## 2. Common Symptoms & Remedies

### Symptom: `USB Connected` but `No MAVLink Heartbeat`
- **Cause 1:** Baud rate mismatch. Pixhawk TELEM2 must be set to `57600 baud` (`SERIAL2_BAUD = 57`).
- **Cause 2:** Protocol mismatch. Ensure `SERIAL2_PROTOCOL = 2` (MAVLink2) or `1` (MAVLink1) in ArduPilot parameters.
- **Cause 3:** TX/RX crossed lines. Pixhawk TELEM2 Pin 2 (TX) connects to ESP32 Pin 18 (RX); Pixhawk Pin 3 (RX) connects to ESP32 Pin 17 (TX). Common GND is mandatory.

### Symptom: `Pre-Arm Checks Failing`
- Inspect `latestStatusMessage` in telemetry HUD or click the Pre-Arm Checks dropdown card.
- **`Bad Logging`:** Insert a clean FAT32 formatted MicroSD card into the Pixhawk.
- **`Need 3D Fix` / `High HDOP`:** Ensure drone is outside with open sky visibility ($\ge 6$ satellites).
- **`Compass Not Calibrated` / `Inconsistent Compass`:** Execute compass calibration in Mission Planner or use `STABILIZE` mode for bench verification.
- **`RC Not Detected`:** If flying without an RC transmitter, configure ArduPilot parameter `ARMING_CHECK = 0` or disable RC checks for pure autonomous operations.

### Symptom: `WebSocket Relay Connection Refused`
- Verify Render.com free instance hasn't spun down to sleep (ping `https://saeindia-groundstation.onrender.com/health` in browser).
- Check `RELAY_TOKEN` in `.env` matches the server configuration.

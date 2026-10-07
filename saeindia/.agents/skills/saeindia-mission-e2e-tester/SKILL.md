---
name: saeindia-mission-e2e-tester
description: >-
  Executes end-to-end integration testing for the SAE INDIA Autonomous Drone system.
  Use when the user asks to test the relay server, verify MAVLink packet forwarding,
  or run the telemetry pipeline verification.
---

# SAE INDIA Mission Pipeline End-to-End Verification

This skill executes the automated end-to-end pipeline test verifying bidirectional telemetry flow between:
`Browser GCS Client` $\longleftrightarrow$ `Cloud WebSocket Relay` $\longleftrightarrow$ `Local Connector Agent` $\longleftrightarrow$ `ESP32 / Pixhawk Link`.

---

## 1. Prerequisites

- Node.js runtime installed.
- Dependencies installed in the root directory and in `relay-server/` & `local-connector/`.

---

## 2. Test Execution Workflow

Run the test suite using PowerShell or Bash from the repository root:

```powershell
npm run test:e2e
```

Or execute directly:

```powershell
node test-e2e.cjs
```

---

## 3. What the Test Verifies

1. **Relay Server Startup:** Launches `relay-server/server.js` on port `8765` with token `e2e-secret-key-456`.
2. **WebSocket Client Upgrade:** Connects a browser WebSocket client to `ws://localhost:8765/ws?token=e2e-secret-key-456`.
3. **Local Connector Agent:** Launches `local-connector/connector.js` connecting to the relay.
4. **Binary Uplink Transmission:** Transmits a simulated MAVLink v2 Heartbeat frame (`0xFD 0x09 ...`) through the entire network pipe.
5. **Frame Verification:** Confirms that binary MAVLink frames are received by the client without payload degradation.

---

## 4. Troubleshooting Failures

- **Port in Use:** If port 8765 or 8443 is blocked, inspect running Node processes:
  ```powershell
  Get-Process node | Stop-Process -Force
  ```
- **Missing `ws` Dependency:**
  ```powershell
  npm install ws
  cd relay-server && npm install && cd ..
  cd local-connector && npm install && cd ..
  ```
- **Token Mismatch:** Verify `RELAY_TOKEN` in `.env` matches the connection query parameter.

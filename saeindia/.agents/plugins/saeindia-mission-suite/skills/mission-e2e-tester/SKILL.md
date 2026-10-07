---
name: mission-e2e-tester
description: >-
  Executes end-to-end integration testing for the SAE INDIA Autonomous Drone system.
  Verifies the cloud relay server and binary MAVLink frame transmission.
---

# SAE INDIA Mission Pipeline End-to-End Verification

Execute:
```powershell
npm run test:e2e
```
Or directly:
```powershell
node test-e2e.cjs
```

Verifies relay server startup on port 8765, token handshake, connector connection, and bidirectional MAVLink v2 binary packet delivery.

# Rule 03: Computer Vision, QR Validation & Visual Servoing

This rule defines constraints and operational standards for optical target tracking, QR code detection, image filtering, and runner radio handshake procedures.

---

## 1. Competition Target Format & Validation

1. **Numeric Regex Invariant:**
   - The competition payload is strictly a **two-digit numeric integer** (`00` to `99`).
   - Every candidate string from `jsQR` must be validated against:
     ```typescript
     const isValidTwoDigit = /^\d{2}$/.test(rawCode.trim());
     ```
   - Ignore or reject URLs, Wi-Fi credentials, or random alphanumeric strings.
2. **Snapshot Persistence:**
   - Upon valid detection, capture a crisp snapshot data URL of the canvas frame.
   - Attach normalized bounding box coordinates (`xPercent`, `yPercent`, `widthPercent`, `heightPercent`) and corner vertices.
   - Record detection timestamp and confidence score.

---

## 2. Dynamic Optical Zoom & Periodic Photo Capture

1. **Autonomous Dynamic Zoom Sweep:**
   - To detect targets from high altitude (10m - 15m), the system executes a continuous 2-second dynamic zoom sweep between $1.0\times$ and $5.0\times$.
   - Hardware camera constraints (`MediaTrackConstraints.zoom`) must be probed first; fallback to high-resolution canvas digital zoom if hardware optical zoom is unavailable.
2. **10-Second Periodic Capture & Auto-Purge:**
   - While in `SEARCHING` or `INSPECTING` states, the vision service captures high-resolution inspection photos every 10 seconds.
   - Unverified photos (no valid QR found) must be automatically purged from memory after analysis to prevent mobile memory bloat.

---

## 3. Ground Box Contour Detection & Servoing

1. **Cardboard & White Plate Detection:**
   - The box detector operates in real-time scanning for kraft brown ratios ($R > G > B$) and high-luminance white top face contrast.
   - Exponential Moving Average (EMA, $\alpha = 0.5$) must be applied to prevent jitter across consecutive video frames.
2. **Proportional Visual Guidance:**
   - When a target box is acquired, guidance calculations compute offset percentages from frame center:
     $$\Delta X = \frac{X_{\text{box}} - X_{\text{center}}}{X_{\text{center}}}, \quad \Delta Y = \frac{Y_{\text{box}} - Y_{\text{center}}}{Y_{\text{center}}}$$
   - Flight control commands (`forwardSpeedMs`, `lateralSpeedMs`) must be strictly clamped to safe limits (maximum $\pm 1.5\text{ m/s}$) to prevent aggressive control oscillation.

---

## 4. Runner P2P Communications & Instant ACK

1. **Zero-Touch Dispatch:**
   - Upon confirming a valid 2-digit QR code, the Drone Android device dispatches the payload across the P2P radio link immediately.
   - The transmission protocol utilizes `BroadcastChannel('SAE_DIRECT_P2P_LINK')` with a fallback to `window.storage` synchronization events.
2. **Automated Handshake:**
   - The Runner Android device displays the received code instantly with high-contrast text and dispatches an ACK (`QR_ACK`) back to the Drone without requiring user interaction.
   - The Drone tracks round-trip latency ($\sim 80\text{ms} - 300\text{ms}$).
   - Once ACK is confirmed, the Drone transitions state to `'RUNNER_CONFIRMED'` and executes Return-To-Launch.

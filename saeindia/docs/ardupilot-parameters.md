# ArduPilot Copter Parameters for SAE INDIA RC-Bridge

These parameters must be configured in **Mission Planner** or **QGroundControl** on the Pixhawk autopilot (ArduPilot Copter $\ge 4.0$).

---

## 1. Radio Channel Mapping (AETR)

```ini
RCMAP_ROLL      = 1    ; Channel 1 controls Roll (Aileron)
RCMAP_PITCH     = 2    ; Channel 2 controls Pitch (Elevator)
RCMAP_THROTTLE  = 3    ; Channel 3 controls Throttle
RCMAP_YAW       = 4    ; Channel 4 controls Yaw (Rudder)
```

---

## 2. Flight Mode Channel & 6-Position PWM Bands

```ini
FLTMODE_CH      = 5    ; Channel 5 controls Flight Mode
FLTMODE1        = 0    ; STABILIZE (PWM 0 - 1230, commanded: 1165 us)
FLTMODE2        = 2    ; ALT_HOLD  (PWM 1231 - 1360, commanded: 1295 us)
FLTMODE3        = 5    ; LOITER    (PWM 1361 - 1490, commanded: 1425 us)
FLTMODE4        = 3    ; AUTO      (PWM 1491 - 1620, commanded: 1555 us)
FLTMODE5        = 6    ; RTL       (PWM 1621 - 1749, commanded: 1685 us)
FLTMODE6        = 9    ; LAND      (PWM 1750 - 2047, commanded: 1815 us)
```

---

## 3. Auxiliary Switches & Safety Options

```ini
RC7_OPTION      = 41   ; Arm / Disarm switch (Low = Disarm, High = Arm)
RC8_OPTION      = 31   ; Motor Emergency Stop (Kill switch - cuts motor outputs immediately)
```

---

## 4. Hardware & Failsafe Safeguards

```ini
FS_THR_ENABLE   = 1    ; Enabled: Always RTL on RC receiver link loss
FS_THR_VALUE    = 975  ; Threshold PWM in microseconds (trigger RTL if throttle < 975 us)
FS_GCS_ENABLE   = 1    ; Enabled: RTL on GCS telemetry link loss (> 4.5s)
ARMING_CHECK    = 1    ; All pre-arm checks enabled (GPS lock, EKF, Compass, Barometer, Battery)
FENCE_ENABLE    = 1    ; Geographic containment fence enabled
FENCE_ACTION    = 1    ; RTL when geofence boundary is breached
BRD_SAFETYENABLE= 0    ; Physical safety button disabled for autonomous field competitions
```

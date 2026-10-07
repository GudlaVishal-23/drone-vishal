# EdgeTX Configuration Guide for SAE INDIA RC-Bridge

This guide explains how to configure **RadioMaster TX16S, Boxer, or TX12** transmitters running **EdgeTX ($\ge 2.8$)** for automated channel injection with instantaneous safety-pilot physical override.

---

## 1. Model Setup: Trainer Mode

1. Power on your transmitter and navigate to **Model Setup** (`MDL`).
2. Scroll to the **Trainer** section at the bottom of the page:
   - **Mode:** `Master / Jack` (for 3.5mm DSC trainer port) OR `Master / Serial` (for AUX/VCP port).
   - **Channels:** `CH1 - CH16`.
   - **Channel Order:** `AETR` (Aileron/Roll, Elevator/Pitch, Throttle, Rudder/Yaw).

---

## 2. Mixer Configuration (Channel Mapping)

Ensure your Mixer is configured according to the standard SAE INDIA channel map:

| Channel | Input / Source | Role | Normal Limits |
| :--- | :--- | :--- | :--- |
| **CH1** | `TR1` (Trainer 1) | Roll / Aileron | 1000 - 2000 us (Center 1500) |
| **CH2** | `TR2` (Trainer 2) | Pitch / Elevator | 1000 - 2000 us (Center 1500) |
| **CH3** | `TR3` (Trainer 3) | Throttle | 1000 - 2000 us (Min 1000) |
| **CH4** | `TR4` (Trainer 4) | Yaw / Rudder | 1000 - 2000 us (Center 1500) |
| **CH5** | `TR5` (Trainer 5) | Flight Mode 6-Position | 1000 - 2000 us |
| **CH6** | `TR6` (Trainer 6) | Gimbal Pitch | 1000 - 2000 us |
| **CH7** | `TR7` (Trainer 7) | Arm Switch (`RC7_OPTION=41`) | 1000 = Disarm, 2000 = Arm |
| **CH8** | `TR8` (Trainer 8) | Emergency Kill (`RC8_OPTION=31`) | 1000 = Normal, 2000 = Kill |

---

## 3. Safety Pilot Hardware Override Switch (MANDATORY)

A human safety pilot must always be capable of seizing physical control from laptop injection in $< 50\text{ms}$.

### EdgeTX Special Function Setup:
1. Go to **Model Settings $\rightarrow$ Special Functions** (`SF`).
2. Add Special Function **SF1**:
   - **Switch:** `SA↓` (or momentary switch `SH↓`).
   - **Action:** `Trainer`.
   - **Value:** `Sticks` (or `Channels 1-4`).
   - **Enable:** `ON` (Checked).
3. **Behavior:**
   - When switch `SA` is in the **DOWN** position, laptop channel injection is active.
   - The instant the safety pilot flips switch `SA` **UP**, the transmitter mixer immediately switches back to the physical gimbal sticks, giving the pilot 100% manual control.

---

## 4. Failsafe Setup on the Receiver

In the transmitter's internal RF configuration (e.g. ExpressLRS or Crossfire Lua script):
- Set **Failsafe Mode** to: `Custom` or `No Pulses`.
- If using `Custom`, configure:
  - **CH3 (Throttle):** `975 us` (below Pixhawk `FS_THR_VALUE=975` to trigger RTL).
  - **CH5 (Mode):** `1685 us` (RTL).
  - **CH7 (Arm):** `1000 us` (Disarm on touchdown).
  - **CH8 (Kill):** `1000 us` (Normal).

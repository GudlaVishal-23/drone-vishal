# SAE INDIA RC-Bridge — Hardware Wiring & Trainer Connection Guide

This guide details the physical connection between the Ground Laptop running the `local-agent` and the RadioMaster / EdgeTX transmitter.

---

## ⚠️ CRITICAL NOTICE: USB Joystick Mode vs. Trainer/Serial Mode

> **IMPORTANT:**  
> When connecting a radio transmitter (such as the RadioMaster TX16S, Boxer, or TX12) via USB, the transmitter offers a choice: **"USB Joystick (HID)"** or **"USB Storage / Serial (VCP)"**.  
> **"USB Joystick" mode is strictly read-only for the PC.** In joystick mode, the TX transmits gimbal stick positions *to* the computer for flight simulators; it **CANNOT** accept channel commands *from* the computer.  
> To inject channels into the transmitter, you must use one of the two methods below.

---

## Method 1: USB-to-UART Adapter to Trainer / DSC Port (Recommended)

Connect a standard USB-to-UART serial adapter (FTDI FT232RL or CP2102) from the laptop USB port to the 3.5mm DSC/Trainer audio jack on the transmitter.

### 3.5mm Audio Jack Pinout:
```
           +-----------------------------+
3.5mm Plug: | TIP | RING (NC) | SLEEVE   |
           +-----------------------------+
               |                  |
           PPM / Serial Signal    GND (Common Ground)
               |                  |
               v                  v
         Adapter TX Pin     Adapter GND Pin
```

| Signal | USB-UART Adapter Pin | Transmitter DSC Jack |
| :--- | :--- | :--- |
| **PPM / Inverted SBUS** | `TXD` | **Tip** |
| **Ground** | `GND` | **Sleeve (Outer Ring)** |
| **Power** | `NC (Not connected)` | Do **NOT** connect 5V to the audio jack! |

---

## Method 2: JR Micro Module Bay Serial Input (CRSF / SBUS)

On the back of the RadioMaster TX16S / Boxer is the standard 5-pin JR module bay. When the internal RF module is active, the external bay pins can be configured as a high-speed serial trainer input.

```
+------------------------------------+
|         JR MODULE BAY PINS         |
|                                    |
| [Pin 1] PPM / CRSF Data In (RX)   | <---- USB-UART Adapter TXD Pin
| [Pin 2] Heartbeat / Telemetry (NC) |
| [Pin 3] VCC (Battery V, e.g. 7.4V) | <---- DO NOT CONNECT TO LAPTOP!
| [Pin 4] GND (Common Ground)        | <---- USB-UART Adapter GND Pin
| [Pin 5] S.PORT / Inverted (NC)     |
+------------------------------------+
```

### Wiring Checklist:
- **Pin 1 (Signal):** Connect to USB-UART adapter **TXD**.
- **Pin 4 (Ground):** Connect to USB-UART adapter **GND**.
- **Pins 2, 3, 5:** Leave disconnected.
- Set `TX_PROTOCOL=CRSF` or `TX_PROTOCOL=SBUS` in the laptop agent `.env`.

---

## Safety Pilot Physical Takeover Switch

In EdgeTX:
1. Navigate to **Model Settings $\rightarrow$ Special Functions**.
2. Add a new function:
   - **Switch:** `!SH↓` (or `SA↑`, depending on preferred switch).
   - **Action:** `Trainer`.
   - **Value:** `Sticks`.
   - **Enable:** `ON`.
3. When the switch is released, the physical transmitter gimbals immediately override the injected channels.

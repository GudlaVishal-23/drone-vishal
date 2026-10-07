# Hardware Pinouts, Electrical Constraints & Wiring Specifications

### 1. Pixhawk TELEM2 Pinout & ESP32-S3 Wiring

The Pixhawk TELEM2 connector is a 6-pin JST-GH socket. The exact pin mappings to the ESP32-S3 module are:

| Pixhawk TELEM2 Pin | Signal | ESP32-S3 Pin | Direction | Description |
| :---: | :---: | :---: | :---: | :--- |
| **Pin 1** | **+5V** | **5V / VIN** | Pixhawk $\rightarrow$ ESP32 | Powered via flight LiPo battery / UBEC |
| **Pin 2** | **TX** | **GPIO 18 (RX)** | Pixhawk $\rightarrow$ ESP32 | MAVLink telemetry downlink from flight controller |
| **Pin 3** | **RX** | **GPIO 17 (TX)** | ESP32 $\rightarrow$ Pixhawk | Command and waypoint uplink to flight controller |
| **Pin 4** | **CTS** | **NC** | — | Hardware flow control (Not connected) |
| **Pin 5** | **RTS** | **NC** | — | Hardware flow control (Not connected) |
| **Pin 6** | **GND** | **GND** | Both | Shared common ground reference |

---

### 2. Electrical Power Constraints & Safeguards

- **Bench Testing Warning:** When Pixhawk is connected ONLY via Micro-USB to a laptop without a flight battery attached, the Pixhawk internal power regulator restricts accessory power to $\le 500\text{mA}$. The ESP32-S3's Wi-Fi radio peak current during transmission bursts can reach $\sim 350\text{mA} - 450\text{mA}$, which may cause power dips and random MCU resets.
- **Flight Power Recommendation:** Always power the drone using the primary LiPo battery connected through the Power Module (PM02 / PM07), providing up to $3\text{A}$ steady current at $5.3\text{V}$.

---

### 3. ArduPilot Parameter Configuration (Mission Planner)

Ensure these parameters are set on the Pixhawk:

| Parameter | Recommended Value | Description |
| :--- | :--- | :--- |
| `SERIAL2_PROTOCOL` | `2` | MAVLink v2 protocol |
| `SERIAL2_BAUD` | `57` | 57600 baud communication rate |
| `ARMING_CHECK` | `1` | All standard pre-arm safety checks enabled (or `0` for indoor bench test) |
| `FS_GCS_ENABLE` | `1` | Enable GCS failsafe (RTL on link loss $> 5$s) |
| `FS_BATT_ENABLE` | `2` | RTL on low battery threshold |
| `FS_BATT_MAH` | `1000` | Minimum capacity threshold |
| `FS_BATT_VOLT` | `10.8` | 3S LiPo cutoff (or `14.4` for 4S) |
| `RTL_ALT` | `1500` | Return-To-Launch ascent altitude in cm ($15\text{m}$) |

---

### 4. ESP32 Arduino IDE Compilation Directives

- Board: **`ESP32S3 Dev Module`**
- USB CDC On Boot: **`Enabled`** *(CRITICAL: If disabled, Serial output is redirected to UART0 pins instead of the Type-C USB port)*
- Upload Mode: **`UART0 / Hardware CDC`** or **`USB-OTG CDC`**
- Flash Size: **`8MB (64Mb)`** or **`16MB`**
- Partition Scheme: **`Default 4MB with spiffs`** or **`8MB with fat`**
- PSRAM: **`OPI PSRAM`** (if board has PSRAM) or **`Disabled`**
- Library Dependency: **`ArduinoWebsockets`** by Gil Maimon (v0.5.3+)

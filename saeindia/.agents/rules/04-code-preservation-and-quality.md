# Rule 04: Code Preservation, Type Safety & Zero-Regression Standards

This rule establishes development boundaries to prevent regressions in flight-critical code.

---

## 1. Zero Code Breakage Guarantee

1. **Do NOT Modify Working Flight Algorithms Unnecessarily:**
   - The MAVLink service (`mavlinkService.ts`), mission state machine (`missionEngine.ts`), box tracking (`boxDetectionService.ts`), and native Android USB plugin (`UsbSerialPlugin.java`) represent hundreds of hours of tuning and testing against actual flight controllers.
   - Do not refactor or simplify these modules unless specifically addressing a confirmed bug or missing requirement.
2. **Preserve State Machine Enums:**
   - All 53 enum values in `MissionState` (`src/types/mission.ts`) are hooked into UI components, blackbox loggers, and audio prompts.
   - Never delete or rename existing state enum entries.

---

## 2. Cross-Platform Mobile Standards (Capacitor & Android)

1. **Web & Native Duality:**
   - Any hardware interaction must use `Capacitor.isNativePlatform()` checks to switch cleanly between native Android plugins (`UsbSerialPlugin.java`) and browser fallback APIs (`WebSerial`, `WebUSB`, `WebSockets`).
2. **Touch-First UI Design:**
   - All critical field buttons (Arm, Disarm, Emergency RTL, Takeoff, Set Home) must have minimum touch targets of $48\text{px} \times 48\text{px}$ with high contrast ratios for outdoor sunlight legibility.
3. **No Unhandled Exceptions on Serial Stream:**
   - Serial data arrives asynchronously in high-frequency bursts (up to 50 Hz). Any parsing errors must be caught locally without crashing the main application thread.

---

## 3. Mandatory Build Verification

Before concluding any task involving changes to the code:
1. Run `npm run build` (`tsc && vite build`) to guarantee strict TypeScript compliance without type errors.
2. Run `npm run test:e2e` (`node test-e2e.cjs`) to verify relay and connector packet routing.
3. Verify that Capacitor sync succeeds: `npx cap sync`.

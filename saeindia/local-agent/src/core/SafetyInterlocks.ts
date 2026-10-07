export interface AircraftStatus {
  armed: boolean;
  flightMode: string;
  altitudeRelM: number;
}

export class SafetyInterlocks {
  public static readonly THROTTLE_ARMED_FLOOR = 1150;
  public static readonly AIRBORNE_ALT_THRESHOLD_M = 0.4;

  public static applySafetyClamps(
    channels: number[],
    status: AircraftStatus | null
  ): number[] {
    const clamped = [...channels];

    // Global hard clamps 1000..2000 us
    for (let i = 0; i < 16; i++) {
      clamped[i] = Math.max(1000, Math.min(2000, Math.round(clamped[i] || 1500)));
    }

    if (!status) return clamped;

    // Safety Interlock 1: Throttle Floor when Armed & Airborne
    // If airborne (> 0.4m) and armed, never allow throttle below 1150 us (unless in LAND mode)
    if (status.armed && status.altitudeRelM > SafetyInterlocks.AIRBORNE_ALT_THRESHOLD_M) {
      if (status.flightMode !== 'LAND' && status.flightMode !== 'RTL') {
        if (clamped[2] < SafetyInterlocks.THROTTLE_ARMED_FLOOR) {
          clamped[2] = SafetyInterlocks.THROTTLE_ARMED_FLOOR;
        }
      }
    }

    return clamped;
  }

  public static canDisarm(status: AircraftStatus | null, confirmed: boolean): boolean {
    if (!status) return true;
    // Airborne disarm requires high-severity explicit confirmation
    if (status.altitudeRelM > SafetyInterlocks.AIRBORNE_ALT_THRESHOLD_M) {
      return confirmed === true;
    }
    return true;
  }
}

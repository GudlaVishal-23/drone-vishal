export interface SlewConfig {
  channel: number; // 1-indexed (1..16)
  maxRateUsPerSec: number;
}

export class SlewLimiter {
  private currentValues: number[] = new Array(16).fill(1500);
  private slewRates: number[] = new Array(16).fill(2500); // Default 2500 us/s

  constructor() {
    // CH1 (Roll): 2000 us/s
    this.slewRates[0] = 2000;
    // CH2 (Pitch): 2000 us/s
    this.slewRates[1] = 2000;
    // CH3 (Throttle): 1500 us/s
    this.slewRates[2] = 1500;
    // CH4 (Yaw): 2000 us/s
    this.slewRates[3] = 2000;
    // CH5 (Mode): Instantaneous (99999 us/s)
    this.slewRates[4] = 99999;
    // CH6 (Gimbal): 1000 us/s
    this.slewRates[5] = 1000;
    // CH7 (Arm): Instantaneous (99999 us/s)
    this.slewRates[6] = 99999;
    // CH8 (Kill): Instantaneous (99999 us/s)
    this.slewRates[7] = 99999;
  }

  public setInitialValues(initial: number[]): void {
    for (let i = 0; i < 16; i++) {
      this.currentValues[i] = initial[i] !== undefined ? initial[i] : 1500;
    }
  }

  public update(targetValues: number[], dtSeconds: number): number[] {
    const updated = new Array(16);
    for (let i = 0; i < 16; i++) {
      const target = targetValues[i] !== undefined ? targetValues[i] : 1500;
      const current = this.currentValues[i];
      const maxChange = this.slewRates[i] * dtSeconds;

      if (Math.abs(target - current) <= maxChange) {
        this.currentValues[i] = target;
      } else if (target > current) {
        this.currentValues[i] = current + maxChange;
      } else {
        this.currentValues[i] = current - maxChange;
      }
      updated[i] = Math.round(this.currentValues[i]);
    }
    return updated;
  }

  public getCurrentValues(): number[] {
    return [...this.currentValues];
  }
}

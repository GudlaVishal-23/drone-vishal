export class ChannelManager {
  private targetChannels: number[] = new Array(16).fill(1500);

  constructor() {
    this.resetToDefaults();
  }

  public resetToDefaults(): void {
    this.targetChannels[0] = 1500; // Roll
    this.targetChannels[1] = 1500; // Pitch
    this.targetChannels[2] = 1000; // Throttle low
    this.targetChannels[3] = 1500; // Yaw
    this.targetChannels[4] = 1425; // Mode: LOITER (1425 us)
    this.targetChannels[5] = 1500; // Gimbal
    this.targetChannels[6] = 1000; // Arm: Disarmed (1000 us)
    this.targetChannels[7] = 1000; // Kill: Normal (1000 us)
    for (let i = 8; i < 16; i++) {
      this.targetChannels[i] = 1500;
    }
  }

  public setChannel(chIndex: number, pwm: number): void {
    if (chIndex < 1 || chIndex > 16) return;
    const clamped = Math.max(1000, Math.min(2000, Math.round(pwm)));
    this.targetChannels[chIndex - 1] = clamped;
  }

  public getChannel(chIndex: number): number {
    if (chIndex < 1 || chIndex > 16) return 1500;
    return this.targetChannels[chIndex - 1];
  }

  public getTargetChannels(): number[] {
    return [...this.targetChannels];
  }

  public setSticksNeutral(): void {
    this.targetChannels[0] = 1500; // Roll
    this.targetChannels[1] = 1500; // Pitch
    this.targetChannels[3] = 1500; // Yaw
  }

  public setModePwm(pwm: number): void {
    this.setChannel(5, pwm);
  }

  public setArmPwm(pwm: number): void {
    this.setChannel(7, pwm);
  }

  public setKillPwm(pwm: number): void {
    this.setChannel(8, pwm);
  }

  public setGimbalPwm(pwm: number): void {
    this.setChannel(6, pwm);
  }
}

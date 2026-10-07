import { ChannelManager } from './ChannelManager.js';

export type AgentState =
  | 'OK'
  | 'CLOUD_DEGRADED'
  | 'CLOUD_LOST'
  | 'FAILSAFE_RTL'
  | 'TX_SERIAL_LOST'
  | 'MANUAL_OVERRIDE';

export class LinkLossStateMachine {
  private currentState: AgentState = 'OK';
  private lastCloudHeardAt: number = Date.now();
  private channelManager: ChannelManager;
  private failsafeTriggeredAt: number = 0;
  private alarmActive: boolean = false;

  public readonly CLOUD_DEGRADED_TIMEOUT_MS = 2000;
  public readonly CLOUD_LOST_TIMEOUT_MS = 5000;

  constructor(channelManager: ChannelManager) {
    this.channelManager = channelManager;
  }

  public recordCloudActivity(): void {
    this.lastCloudHeardAt = Date.now();
    if (this.currentState === 'CLOUD_DEGRADED') {
      this.currentState = 'OK';
      this.alarmActive = false;
      console.log('[LINK-LOSS] Cloud connection restored. Resuming normal operations.');
    }
  }

  public triggerManualOverride(reason = 'Operator pressed SPACE'): void {
    this.currentState = 'MANUAL_OVERRIDE';
    this.channelManager.setSticksNeutral();
    this.channelManager.setArmPwm(1000); // Disarm
    this.alarmActive = true;
    console.warn(`[MANUAL OVERRIDE] ${reason}! Channel injection neutral and halted.`);
  }

  public triggerSerialLost(): void {
    this.currentState = 'TX_SERIAL_LOST';
    this.alarmActive = true;
    console.error('[LINK-LOSS] TX Serial connection lost! Failsafe receiver will take over.');
  }

  public updateTick(): AgentState {
    if (this.currentState === 'MANUAL_OVERRIDE' || this.currentState === 'TX_SERIAL_LOST') {
      return this.currentState;
    }

    const now = Date.now();
    const cloudAge = now - this.lastCloudHeardAt;

    // Condition 1: Lost > 5s -> FAILSAFE_RTL
    if (cloudAge > this.CLOUD_LOST_TIMEOUT_MS) {
      if (this.currentState !== 'FAILSAFE_RTL') {
        this.currentState = 'FAILSAFE_RTL';
        this.failsafeTriggeredAt = now;
        this.alarmActive = true;
        // Command RTL on CH5 (1685 us) and mid-throttle
        this.channelManager.setModePwm(1685);
        this.channelManager.setSticksNeutral();
        this.channelManager.setChannel(3, 1500);
        console.warn(`[LINK-LOSS FAILSAFE] Cloud link lost for ${cloudAge}ms! COMMANDED RTL ON CH5 (1685 us)!`);
      }
      return this.currentState;
    }

    // Condition 2: Lost > 2s -> CLOUD_DEGRADED (Freeze sticks, HOLD)
    if (cloudAge > this.CLOUD_DEGRADED_TIMEOUT_MS) {
      if (this.currentState !== 'CLOUD_DEGRADED') {
        this.currentState = 'CLOUD_DEGRADED';
        this.channelManager.setSticksNeutral();
        console.warn(`[LINK-LOSS WARNING] Cloud link degraded (${cloudAge}ms). Freezing sticks neutral.`);
      }
      return this.currentState;
    }

    // Normal State
    this.currentState = 'OK';
    this.alarmActive = false;
    return this.currentState;
  }

  public getCurrentState(): AgentState {
    return this.currentState;
  }

  public isAlarmActive(): boolean {
    return this.alarmActive;
  }

  public getCloudAgeMs(): number {
    return Date.now() - this.lastCloudHeardAt;
  }
}

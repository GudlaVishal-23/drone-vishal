import { ChannelManager } from './ChannelManager.js';
import { SafetyInterlocks, AircraftStatus } from './SafetyInterlocks.js';

export interface CommandScriptExecution {
  commandId: string;
  type: string;
  params: any;
  startTime: number;
  status: 'ACCEPTED' | 'EXECUTING' | 'DONE' | 'REJECTED';
  message?: string;
  targetMode?: string;
  nudgeEndTime?: number;
  nudgeChannel?: number;
}

export class ScriptEngine {
  private channelManager: ChannelManager;
  private activeExecution: CommandScriptExecution | null = null;

  private readonly FLIGHT_MODE_PWMS: Record<string, number> = {
    STABILIZE: 1165,
    ALT_HOLD: 1295,
    LOITER: 1425,
    AUTO: 1555,
    RTL: 1685,
    LAND: 1815
  };

  constructor(channelManager: ChannelManager) {
    this.channelManager = channelManager;
  }

  public executeCommand(
    command: { id: string; type: string; params?: any },
    aircraftStatus: AircraftStatus | null
  ): { status: 'ACCEPTED' | 'REJECTED'; message?: string } {
    const now = Date.now();

    switch (command.type) {
      case 'SET_MODE': {
        const mode = command.params?.mode?.toUpperCase();
        const pwm = this.FLIGHT_MODE_PWMS[mode];
        if (!pwm) {
          return { status: 'REJECTED', message: `Unknown flight mode "${mode}"` };
        }
        this.channelManager.setModePwm(pwm);
        this.activeExecution = {
          commandId: command.id,
          type: command.type,
          params: command.params,
          startTime: now,
          status: 'EXECUTING',
          targetMode: mode
        };
        return { status: 'ACCEPTED', message: `Commanded CH5 mode PWM ${pwm} for ${mode}` };
      }

      case 'ARM': {
        this.channelManager.setArmPwm(2000); // Pulse ARM high
        this.activeExecution = {
          commandId: command.id,
          type: command.type,
          params: command.params,
          startTime: now,
          status: 'EXECUTING'
        };
        return { status: 'ACCEPTED', message: 'Commanded CH7 ARM high (2000 us)' };
      }

      case 'DISARM': {
        const confirmed = Boolean(command.params?.confirm);
        if (!SafetyInterlocks.canDisarm(aircraftStatus, confirmed)) {
          return {
            status: 'REJECTED',
            message: 'Airborne disarm rejected: altitude > 0.4m requires explicit confirmation'
          };
        }
        this.channelManager.setArmPwm(1000); // Pulse DISARM low
        this.activeExecution = {
          commandId: command.id,
          type: command.type,
          params: command.params,
          startTime: now,
          status: 'EXECUTING'
        };
        return { status: 'ACCEPTED', message: 'Commanded CH7 DISARM low (1000 us)' };
      }

      case 'HOLD': {
        this.channelManager.setModePwm(this.FLIGHT_MODE_PWMS['LOITER']);
        this.channelManager.setSticksNeutral();
        this.channelManager.setChannel(3, 1500); // Mid-throttle hold
        this.activeExecution = {
          commandId: command.id,
          type: command.type,
          params: command.params,
          startTime: now,
          status: 'EXECUTING',
          targetMode: 'LOITER'
        };
        return { status: 'ACCEPTED', message: 'HOLD activated: LOITER mode, sticks centered' };
      }

      case 'RTL':
      case 'EMERGENCY_RTL': {
        this.channelManager.setModePwm(this.FLIGHT_MODE_PWMS['RTL']);
        this.channelManager.setSticksNeutral();
        this.channelManager.setChannel(3, 1500); // Safe mid-throttle
        this.activeExecution = {
          commandId: command.id,
          type: command.type,
          params: command.params,
          startTime: now,
          status: 'EXECUTING',
          targetMode: 'RTL'
        };
        return { status: 'ACCEPTED', message: `${command.type} activated: RTL mode (1685 us)` };
      }

      case 'LAND': {
        this.channelManager.setModePwm(this.FLIGHT_MODE_PWMS['LAND']);
        this.channelManager.setSticksNeutral();
        this.activeExecution = {
          commandId: command.id,
          type: command.type,
          params: command.params,
          startTime: now,
          status: 'EXECUTING',
          targetMode: 'LAND'
        };
        return { status: 'ACCEPTED', message: 'LAND mode activated (1815 us)' };
      }

      case 'NUDGE': {
        const { axis, direction, magnitude = 0.5, durationMs = 500 } = command.params || {};
        const safeDuration = Math.min(Math.max(durationMs, 50), 1500);
        const safeMag = Math.min(Math.max(magnitude, 0.0), 1.0);
        const offset = Math.round(safeMag * 250) * (direction === 'NEG' ? -1 : 1);

        let ch = 1;
        if (axis === 'PITCH') ch = 2;
        if (axis === 'YAW') ch = 4;

        this.channelManager.setChannel(ch, 1500 + offset);
        this.activeExecution = {
          commandId: command.id,
          type: command.type,
          params: command.params,
          startTime: now,
          status: 'EXECUTING',
          nudgeChannel: ch,
          nudgeEndTime: now + safeDuration
        };
        return { status: 'ACCEPTED', message: `Nudged ${axis} by ${offset} us for ${safeDuration}ms` };
      }

      case 'KILL': {
        if (!command.params?.confirm) {
          return { status: 'REJECTED', message: 'KILL rejected: confirm must be true' };
        }
        this.channelManager.setKillPwm(2000); // Motor emergency kill active
        this.channelManager.setArmPwm(1000);  // Also drop arm switch
        this.channelManager.setChannel(3, 1000); // Drop throttle
        this.activeExecution = {
          commandId: command.id,
          type: command.type,
          params: command.params,
          startTime: now,
          status: 'DONE',
          message: 'EMERGENCY KILL TRIGGERED: Motor cut-off asserted on CH8'
        };
        return { status: 'ACCEPTED', message: 'EMERGENCY MOTOR KILL EXECUTED' };
      }

      case 'GIMBAL': {
        if (command.params?.pitchPwm) {
          this.channelManager.setGimbalPwm(command.params.pitchPwm);
        }
        this.activeExecution = {
          commandId: command.id,
          type: command.type,
          params: command.params,
          startTime: now,
          status: 'DONE',
          message: 'Gimbal position updated'
        };
        return { status: 'ACCEPTED', message: 'Gimbal PWM updated' };
      }

      case 'HEARTBEAT': {
        return { status: 'ACCEPTED', message: 'Heartbeat acknowledged' };
      }

      default:
        return { status: 'REJECTED', message: `Unsupported command type "${command.type}"` };
    }
  }

  /**
   * Called on each 50 Hz tick to evaluate active script completion and closed-loop verification.
   */
  public updateTick(aircraftStatus: AircraftStatus | null): CommandScriptExecution | null {
    if (!this.activeExecution || this.activeExecution.status !== 'EXECUTING') {
      return null;
    }

    const exec = this.activeExecution;
    const now = Date.now();
    const elapsed = now - exec.startTime;

    // 1. Nudge completion check (return stick to 1500)
    if (exec.nudgeEndTime && now >= exec.nudgeEndTime) {
      if (exec.nudgeChannel) {
        this.channelManager.setChannel(exec.nudgeChannel, 1500);
      }
      exec.status = 'DONE';
      exec.message = 'Nudge completed, stick returned to center';
      return exec;
    }

    // 2. Closed-Loop Mode Verification
    if (exec.targetMode && aircraftStatus) {
      if (aircraftStatus.flightMode.toUpperCase() === exec.targetMode) {
        exec.status = 'DONE';
        exec.message = `Verified flight mode is now ${exec.targetMode} via MAVLink closed loop`;
        return exec;
      }
    }

    // 3. Closed-Loop Arm/Disarm Verification
    if (exec.type === 'ARM' && aircraftStatus) {
      if (aircraftStatus.armed) {
        exec.status = 'DONE';
        exec.message = 'Verified aircraft armed via MAVLink closed loop';
        return exec;
      }
    }

    if (exec.type === 'DISARM' && aircraftStatus) {
      if (!aircraftStatus.armed) {
        exec.status = 'DONE';
        exec.message = 'Verified aircraft disarmed via MAVLink closed loop';
        return exec;
      }
    }

    // 4. Timeout fallback for closed loop (3 seconds)
    if (elapsed > 3500) {
      exec.status = 'DONE';
      exec.message = `Script execution completed (timeout reached, target commanded: ${exec.type})`;
      return exec;
    }

    return null;
  }

  public getActiveExecution(): CommandScriptExecution | null {
    return this.activeExecution;
  }

  public clearActiveExecution(): void {
    this.activeExecution = null;
  }
}

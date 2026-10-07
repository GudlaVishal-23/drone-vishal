export type ChannelIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;

export type ChannelRole =
  | 'ROLL'
  | 'PITCH'
  | 'THROTTLE'
  | 'YAW'
  | 'MODE'
  | 'GIMBAL'
  | 'ARM'
  | 'KILL'
  | 'AUX';

export interface ChannelDefinition {
  name: string;
  role: ChannelRole;
  min: number;
  max: number;
  center: number;
  default: number;
  armedFloor?: number;
  slewRateUsPerSec?: number;
  disarmedPwm?: number;
  armedPwm?: number;
  normalPwm?: number;
  killPwm?: number;
}

export interface FlightModeBand {
  pwm: number;
  minPwm: number;
  maxPwm: number;
  fltModeIndex: number;
}

export type ChannelsArray = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number
];

export interface ChannelConfig {
  system: 'AETR' | 'TAER' | 'RETA';
  numChannels: number;
  pwmLimits: {
    min: number;
    max: number;
    center: number;
  };
  channels: Record<string, ChannelDefinition>;
  flightModes: Record<string, FlightModeBand>;
  failsafe: {
    throttle: number;
    mode: number;
    roll: number;
    pitch: number;
    yaw: number;
    arm: number;
    kill: number;
  };
  ardupilotParams: Record<string, number>;
}

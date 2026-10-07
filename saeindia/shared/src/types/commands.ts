export type CommandType =
  | 'ARM'
  | 'DISARM'
  | 'SET_MODE'
  | 'TAKEOFF'
  | 'RTL'
  | 'LAND'
  | 'HOLD'
  | 'NUDGE'
  | 'SET_ALTITUDE_HOLD'
  | 'START_MISSION'
  | 'ABORT_MISSION'
  | 'EMERGENCY_RTL'
  | 'KILL'
  | 'GIMBAL'
  | 'HEARTBEAT';

export type CommandStatus =
  | 'QUEUED'
  | 'DELIVERED'
  | 'ACCEPTED'
  | 'EXECUTING'
  | 'DONE'
  | 'REJECTED'
  | 'EXPIRED';

export type FlightModeName =
  | 'STABILIZE'
  | 'ALT_HOLD'
  | 'LOITER'
  | 'AUTO'
  | 'RTL'
  | 'LAND';

export interface ArmParams {
  force?: boolean;
}

export interface DisarmParams {
  confirm?: boolean;
  reason?: string;
}

export interface SetModeParams {
  mode: FlightModeName;
}

export interface TakeoffParams {
  altitudeMeters: number;
}

export interface NudgeParams {
  axis: 'ROLL' | 'PITCH' | 'YAW';
  direction: 'POS' | 'NEG';
  magnitude: number; // 0.0 to 1.0
  durationMs: number; // <= 1500 ms
}

export interface SetAltitudeHoldParams {
  altitudeMeters: number;
}

export interface KillParams {
  confirm: boolean;
  reason: string;
}

export interface GimbalParams {
  pitchPwm?: number; // 1000..2000
  rollPwm?: number;  // 1000..2000
}

export interface HeartbeatParams {
  operatorCallsign?: string;
  uiTimestamp?: number;
}

export type CommandParams =
  | ArmParams
  | DisarmParams
  | SetModeParams
  | TakeoffParams
  | NudgeParams
  | SetAltitudeHoldParams
  | KillParams
  | GimbalParams
  | HeartbeatParams
  | Record<string, unknown>;

export interface RcCommand {
  id: string; // UUID v4
  type: CommandType;
  params?: CommandParams;
  issuedAt: number; // Unix timestamp in ms
  ttlMs: number;    // Time-to-live in ms (e.g. 1000..30000)
  nonce: string;    // Unique random nonce for replay prevention
  operatorId?: string; // Authenticated user / callsign
}

export interface CommandAckPayload {
  commandId: string;
  status: CommandStatus;
  statusMessage?: string;
  timestamp: number;
  telemetrySnapshot?: {
    armed?: boolean;
    mode?: string;
    altitude?: number;
    channels?: number[];
  };
}

export interface CommandRecord {
  command: RcCommand;
  status: CommandStatus;
  statusMessage?: string;
  createdAt: number;
  updatedAt: number;
  deliveredAt?: number;
  completedAt?: number;
  ackDetails?: CommandAckPayload;
}

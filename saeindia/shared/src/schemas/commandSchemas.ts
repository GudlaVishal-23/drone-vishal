import { z } from 'zod';

export const CommandTypeEnum = z.enum([
  'ARM',
  'DISARM',
  'SET_MODE',
  'TAKEOFF',
  'RTL',
  'LAND',
  'HOLD',
  'NUDGE',
  'SET_ALTITUDE_HOLD',
  'START_MISSION',
  'ABORT_MISSION',
  'EMERGENCY_RTL',
  'KILL',
  'GIMBAL',
  'HEARTBEAT'
]);

export const FlightModeEnum = z.enum([
  'STABILIZE',
  'ALT_HOLD',
  'LOITER',
  'AUTO',
  'RTL',
  'LAND'
]);

export const ArmParamsSchema = z.object({
  force: z.boolean().optional()
});

export const DisarmParamsSchema = z.object({
  confirm: z.boolean().optional(),
  reason: z.string().optional()
});

export const SetModeParamsSchema = z.object({
  mode: FlightModeEnum
});

export const TakeoffParamsSchema = z.object({
  altitudeMeters: z.number().min(0.5).max(50)
});

export const NudgeParamsSchema = z.object({
  axis: z.enum(['ROLL', 'PITCH', 'YAW']),
  direction: z.enum(['POS', 'NEG']),
  magnitude: z.number().min(0).max(1),
  durationMs: z.number().min(50).max(1500)
});

export const SetAltitudeHoldParamsSchema = z.object({
  altitudeMeters: z.number().min(0).max(50)
});

export const KillParamsSchema = z.object({
  confirm: z.literal(true, {
    message: 'KILL command requires explicit confirm: true'
  }),
  reason: z.string().min(3, 'Reason for KILL must be provided')
});

export const GimbalParamsSchema = z.object({
  pitchPwm: z.number().min(1000).max(2000).optional(),
  rollPwm: z.number().min(1000).max(2000).optional()
});

export const HeartbeatParamsSchema = z.object({
  operatorCallsign: z.string().optional(),
  uiTimestamp: z.number().optional()
});

export const RcCommandSchema = z.object({
  id: z.string().uuid('Command ID must be a valid UUID v4'),
  type: CommandTypeEnum,
  params: z.record(z.string(), z.unknown()).optional(),
  issuedAt: z.number().positive(),
  ttlMs: z.number().min(500).max(60000),
  nonce: z.string().min(6).max(128),
  operatorId: z.string().optional()
});

export const CommandAckSchema = z.object({
  commandId: z.string().uuid(),
  status: z.enum(['QUEUED', 'DELIVERED', 'ACCEPTED', 'EXECUTING', 'DONE', 'REJECTED', 'EXPIRED']),
  statusMessage: z.string().optional(),
  timestamp: z.number(),
  telemetrySnapshot: z.object({
    armed: z.boolean().optional(),
    mode: z.string().optional(),
    altitude: z.number().optional(),
    channels: z.array(z.number()).optional()
  }).optional()
});

export const AgentTelemetrySchema = z.object({
  channels: z.array(z.number().min(900).max(2100)).length(16),
  loopRateHz: z.number().min(0).max(500),
  jitterMs: z.number().min(0),
  serialErrors: z.number().min(0),
  cloudRttMs: z.number().min(0),
  lastCommandId: z.string().uuid().optional(),
  linkState: z.enum(['OK', 'CLOUD_DEGRADED', 'CLOUD_LOST', 'TX_SERIAL_LOST', 'FAILSAFE_RTL', 'MANUAL_OVERRIDE']),
  timestamp: z.number(),
  txPort: z.string().optional(),
  txProtocol: z.enum(['CRSF', 'SBUS', 'PPM', 'MOCK']).optional(),
  activeScript: z.string().optional()
});

export type AgentLinkState =
  | 'OK'
  | 'CLOUD_DEGRADED'
  | 'CLOUD_LOST'
  | 'TX_SERIAL_LOST'
  | 'FAILSAFE_RTL'
  | 'MANUAL_OVERRIDE';

export interface AircraftStateSnapshot {
  armed: boolean;
  flightMode: string;
  altitudeRelM: number;
  batteryVoltage: number;
  batteryPct: number;
  gpsFixType: number;
  satellitesVisible: number;
  hdop: number;
  lastHeartbeatAgeMs: number;
  ekfOk?: boolean;
}

export interface AgentTelemetry {
  channels: number[]; // 16 values (1000..2000 us)
  loopRateHz: number;
  jitterMs: number;
  serialErrors: number;
  cloudRttMs: number;
  lastCommandId?: string;
  linkState: AgentLinkState;
  timestamp: number;
  txPort?: string;
  txProtocol?: 'CRSF' | 'SBUS' | 'PPM' | 'MOCK';
  aircraft?: AircraftStateSnapshot;
  activeScript?: string;
}

export interface CloudRcState {
  agentOnline: boolean;
  agentLastSeenAgeMs: number;
  telemetry: AgentTelemetry | null;
  activeCommandsCount: number;
  lastCommand: {
    id: string;
    type: string;
    status: string;
    updatedAt: number;
  } | null;
  serverTimestamp: number;
}

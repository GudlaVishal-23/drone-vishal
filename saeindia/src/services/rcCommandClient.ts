// High-integrity RC Command API client for Ground Control Station (GCS)
// Dispatches replay-protected, idempotent flight commands to the Cloud Command API.

export type RcCommandType =
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

export interface RcCommandPayload {
  id: string;
  type: RcCommandType;
  params?: Record<string, any>;
  issuedAt: number;
  ttlMs: number;
  nonce: string;
  operatorId?: string;
}

export interface RcCommandRecord {
  command: RcCommandPayload;
  status: 'QUEUED' | 'DELIVERED' | 'ACCEPTED' | 'EXECUTING' | 'DONE' | 'REJECTED' | 'EXPIRED';
  statusMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CloudRcStateSnapshot {
  agentOnline: boolean;
  agentLastSeenAgeMs: number;
  telemetry: {
    channels: number[];
    loopRateHz: number;
    jitterMs: number;
    serialErrors: number;
    cloudRttMs: number;
    lastCommandId?: string;
    linkState: string;
    timestamp: number;
    txPort?: string;
    txProtocol?: string;
    activeScript?: string;
  } | null;
  activeCommandsCount: number;
  totalCommandsProcessed: number;
  lastCommand: {
    id: string;
    type: string;
    status: string;
    updatedAt: number;
  } | null;
  serverTimestamp: number;
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 16; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

class RcCommandClientService {
  private baseUrl: string = '';
  private token: string = '';
  private heartbeatTimer: any = null;
  private statePollTimer: any = null;
  private stateListeners: Set<(state: CloudRcStateSnapshot) => void> = new Set();
  private lastKnownState: CloudRcStateSnapshot | null = null;

  constructor() {
    this.initEndpoints();
  }

  private initEndpoints(): void {
    const envUrl = (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_SECURE_RELAY_URL)) || '';
    if (envUrl) {
      this.baseUrl = envUrl.replace(/^wss?:\/\//i, 'https://').replace(/\/ws.*$/, '').replace(/\/+$/, '');
    } else if (typeof window !== 'undefined') {
      this.baseUrl = window.location.origin;
    } else {
      this.baseUrl = 'http://localhost:8443';
    }

    const envToken = (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_API_TOKEN || import.meta.env?.VITE_RELAY_TOKEN)) || '';
    this.token = envToken;
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  public setToken(token: string): void {
    this.token = token;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public async sendCommand(
    type: RcCommandType,
    params: Record<string, any> = {},
    ttlMs: number = 8000
  ): Promise<RcCommandRecord> {
    const command: RcCommandPayload = {
      id: generateUuid(),
      type,
      params,
      issuedAt: Date.now(),
      ttlMs,
      nonce: generateNonce(),
      operatorId: 'GCS_ALPHA_01'
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
      headers['x-relay-token'] = this.token;
    }

    const res = await fetch(`${this.baseUrl}/api/v1/command`, {
      method: 'POST',
      headers,
      body: JSON.stringify(command)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(errData.message || `Command ${type} failed with status ${res.status}`);
    }

    const data = await res.json();
    return {
      command,
      status: data.status || 'QUEUED',
      createdAt: data.createdAt || Date.now(),
      updatedAt: Date.now()
    };
  }

  public async fetchState(): Promise<CloudRcStateSnapshot> {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
      headers['x-relay-token'] = this.token;
    }

    const res = await fetch(`${this.baseUrl}/api/v1/state`, {
      method: 'GET',
      headers
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch state: ${res.statusText}`);
    }

    const data: CloudRcStateSnapshot = await res.json();
    this.lastKnownState = data;
    this.notifyListeners(data);
    return data;
  }

  public subscribeState(listener: (state: CloudRcStateSnapshot) => void): () => void {
    this.stateListeners.add(listener);
    if (this.lastKnownState) {
      listener(this.lastKnownState);
    }
    if (!this.statePollTimer) {
      this.startStatePolling();
    }
    return () => {
      this.stateListeners.delete(listener);
      if (this.stateListeners.size === 0) {
        this.stopStatePolling();
      }
    };
  }

  private notifyListeners(state: CloudRcStateSnapshot): void {
    for (const listener of this.stateListeners) {
      try {
        listener(state);
      } catch (e) {}
    }
  }

  public startStatePolling(intervalMs = 1000): void {
    if (this.statePollTimer) clearInterval(this.statePollTimer);
    this.fetchState().catch(() => {});
    this.statePollTimer = setInterval(() => {
      this.fetchState().catch(() => {});
    }, intervalMs);
  }

  public stopStatePolling(): void {
    if (this.statePollTimer) {
      clearInterval(this.statePollTimer);
      this.statePollTimer = null;
    }
  }

  public startHeartbeat(intervalMs = 1000): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.sendCommand('HEARTBEAT', { uiTimestamp: Date.now() }, 3000).catch(() => {});
    }, intervalMs);
  }

  public stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

export const rcCommandClient = new RcCommandClientService();

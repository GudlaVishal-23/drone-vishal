export class CloudApiClient {
  private baseUrl: string;
  private token: string;
  private running = false;
  private onCommandCallback: ((cmd: any) => void) | null = null;
  private rttMs = 0;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = token;
  }

  public setOnCommand(cb: (cmd: any) => void): void {
    this.onCommandCallback = cb;
  }

  public async startPolling(): Promise<void> {
    this.running = true;
    while (this.running) {
      try {
        const start = Date.now();
        const headers: Record<string, string> = {};
        if (this.token) {
          headers['Authorization'] = `Bearer ${this.token}`;
          headers['x-relay-token'] = this.token;
        }

        const res = await fetch(`${this.baseUrl}/api/v1/agent/poll?timeout=25000`, {
          method: 'GET',
          headers
        });

        this.rttMs = Date.now() - start;

        if (res.ok) {
          const data: any = await res.json();
          if (data && Array.isArray(data.commands) && data.commands.length > 0) {
            for (const cmd of data.commands) {
              if (this.onCommandCallback) {
                this.onCommandCallback(cmd);
              }
            }
          }
        } else {
          // If auth fails or endpoint error, wait 2s before retry
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (err) {
        // Network failure, wait 1.5s
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }

  public stopPolling(): void {
    this.running = false;
  }

  public async sendAck(ackPayload: {
    commandId: string;
    status: string;
    statusMessage?: string;
    timestamp: number;
    telemetrySnapshot?: any;
  }): Promise<boolean> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
        headers['x-relay-token'] = this.token;
      }
      const res = await fetch(`${this.baseUrl}/api/v1/agent/ack`, {
        method: 'POST',
        headers,
        body: JSON.stringify(ackPayload)
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  public async sendTelemetry(telemetry: any): Promise<boolean> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
        headers['x-relay-token'] = this.token;
      }
      const res = await fetch(`${this.baseUrl}/api/v1/agent/telemetry`, {
        method: 'POST',
        headers,
        body: JSON.stringify(telemetry)
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  public getRttMs(): number {
    return this.rttMs;
  }
}

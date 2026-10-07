import { AircraftStatus } from '../core/SafetyInterlocks.js';

export class TelemetryBridge {
  private latestStatus: AircraftStatus = {
    armed: false,
    flightMode: 'LOITER',
    altitudeRelM: 0.0
  };
  private lastUpdate: number = Date.now();

  public updateStatus(status: Partial<AircraftStatus>): void {
    this.latestStatus = {
      ...this.latestStatus,
      ...status
    };
    this.lastUpdate = Date.now();
  }

  public getStatus(): AircraftStatus {
    return { ...this.latestStatus };
  }

  public getAgeMs(): number {
    return Date.now() - this.lastUpdate;
  }
}

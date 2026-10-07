import { TxLink } from './TxLink.js';
import { encodeCrsfFrame } from './CrsfTxLink.js';
import { encodeSbusFrame } from './SbusTxLink.js';

export class MockTxLink implements TxLink {
  public name = 'Mock In-Memory Virtual TxLink';
  public protocol: 'MOCK' = 'MOCK';
  private openState = false;
  private errorCount = 0;
  private lastChannels: number[] = [];
  private lastFrame: Uint8Array | null = null;
  public totalFramesSent = 0;
  public simulateDisconnect = false;
  public underlyingEncoding: 'CRSF' | 'SBUS' = 'CRSF';

  async open(): Promise<void> {
    this.openState = true;
  }

  async close(): Promise<void> {
    this.openState = false;
  }

  async sendChannels(channels: number[]): Promise<boolean> {
    if (!this.openState || this.simulateDisconnect) {
      this.errorCount++;
      return false;
    }
    this.lastChannels = [...channels];
    if (this.underlyingEncoding === 'CRSF') {
      this.lastFrame = encodeCrsfFrame(channels);
    } else {
      this.lastFrame = encodeSbusFrame(channels);
    }
    this.totalFramesSent++;
    return true;
  }

  isOpen(): boolean {
    return this.openState && !this.simulateDisconnect;
  }

  getErrorCount(): number {
    return this.errorCount;
  }

  getLastFrame(): Uint8Array | null {
    return this.lastFrame;
  }

  getLastChannels(): number[] {
    return this.lastChannels;
  }
}

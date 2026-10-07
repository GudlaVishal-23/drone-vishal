import { TxLink } from './TxLink.js';

export function encodePpmSerialFrame(channels: number[]): Uint8Array {
  // Serial PPM protocol: 2 sync header bytes + 16 x 2-byte PWM values (LE) + 1 byte checksum
  const frame = new Uint8Array(2 + 16 * 2 + 1);
  frame[0] = 0xFF;
  frame[1] = 0xAA;

  let sum = 0;
  for (let i = 0; i < 16; i++) {
    const pwm = Math.max(800, Math.min(2200, Math.round(channels[i] || 1500)));
    const offset = 2 + i * 2;
    frame[offset] = pwm & 0xFF;
    frame[offset + 1] = (pwm >> 8) & 0xFF;
    sum = (sum + frame[offset] + frame[offset + 1]) & 0xFF;
  }
  frame[frame.length - 1] = sum;
  return frame;
}

export class PpmSerialTxLink implements TxLink {
  public name = 'PPM Serial Sync TxLink';
  public protocol: 'PPM' = 'PPM';
  private portPath: string;
  private openState = false;
  private errorCount = 0;
  private lastFrame: Uint8Array | null = null;
  private serialInstance: any = null;

  constructor(portPath = 'COM5', baudRate = 115200) {
    this.portPath = portPath;
  }

  async open(): Promise<void> {
    try {
      // @ts-ignore
      const { SerialPort } = await import('serialport');
      this.serialInstance = new SerialPort({
        path: this.portPath,
        baudRate: 115200,
        autoOpen: true
      });
      this.openState = true;
    } catch (err: any) {
      console.warn(`[PPM] SerialPort unavailable (${err.message}). Virtual mode active.`);
      this.openState = true;
    }
  }

  async close(): Promise<void> {
    if (this.serialInstance) {
      try {
        await new Promise((res) => this.serialInstance.close(res));
      } catch (e) {}
    }
    this.openState = false;
  }

  async sendChannels(channels: number[]): Promise<boolean> {
    if (!this.openState) return false;
    try {
      const frame = encodePpmSerialFrame(channels);
      this.lastFrame = frame;
      if (this.serialInstance && this.serialInstance.isOpen) {
        this.serialInstance.write(Buffer.from(frame));
      }
      return true;
    } catch (err) {
      this.errorCount++;
      return false;
    }
  }

  isOpen(): boolean {
    return this.openState;
  }

  getErrorCount(): number {
    return this.errorCount;
  }

  getLastFrame(): Uint8Array | null {
    return this.lastFrame;
  }
}

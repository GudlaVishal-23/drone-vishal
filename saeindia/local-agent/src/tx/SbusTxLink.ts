import { TxLink } from './TxLink.js';

export function encodeSbusFrame(channels: number[], failsafe = false, frameLost = false): Uint8Array {
  const frame = new Uint8Array(25);
  frame[0] = 0x0F; // Header

  // Scale 1000..2000 us to 11-bit SBUS range (172..1811)
  const sbusChannels = new Uint16Array(16);
  for (let i = 0; i < 16; i++) {
    const pwm = channels[i] !== undefined ? channels[i] : 1500;
    const clamped = Math.max(1000, Math.min(2000, pwm));
    // 1000 -> 172, 1500 -> 992, 2000 -> 1811
    sbusChannels[i] = Math.round(((clamped - 1000) * (1811 - 172)) / 1000 + 172) & 0x07FF;
  }

  const ch = sbusChannels;
  frame[1]  = (ch[0] & 0xFF);
  frame[2]  = ((ch[0] >> 8) | (ch[1] << 3)) & 0xFF;
  frame[3]  = ((ch[1] >> 5) | (ch[2] << 6)) & 0xFF;
  frame[4]  = ((ch[2] >> 2)) & 0xFF;
  frame[5]  = ((ch[2] >> 10) | (ch[3] << 1)) & 0xFF;
  frame[6]  = ((ch[3] >> 7) | (ch[4] << 4)) & 0xFF;
  frame[7]  = ((ch[4] >> 4) | (ch[5] << 7)) & 0xFF;
  frame[8]  = ((ch[5] >> 1)) & 0xFF;
  frame[9]  = ((ch[5] >> 9) | (ch[6] << 2)) & 0xFF;
  frame[10] = ((ch[6] >> 6) | (ch[7] << 5)) & 0xFF;
  frame[11] = ((ch[7] >> 3)) & 0xFF;
  frame[12] = (ch[8] & 0xFF);
  frame[13] = ((ch[8] >> 8) | (ch[9] << 3)) & 0xFF;
  frame[14] = ((ch[9] >> 5) | (ch[10] << 6)) & 0xFF;
  frame[15] = ((ch[10] >> 2)) & 0xFF;
  frame[16] = ((ch[10] >> 10) | (ch[11] << 1)) & 0xFF;
  frame[17] = ((ch[11] >> 7) | (ch[12] << 4)) & 0xFF;
  frame[18] = ((ch[12] >> 4) | (ch[13] << 7)) & 0xFF;
  frame[19] = ((ch[13] >> 1)) & 0xFF;
  frame[20] = ((ch[13] >> 9) | (ch[14] << 2)) & 0xFF;
  frame[21] = ((ch[14] >> 6) | (ch[15] << 5)) & 0xFF;
  frame[22] = ((ch[15] >> 3)) & 0xFF;

  let flags = 0;
  if (frameLost) flags |= (1 << 2);
  if (failsafe) flags |= (1 << 3);
  frame[23] = flags;
  frame[24] = 0x00; // Footer

  return frame;
}

export class SbusTxLink implements TxLink {
  public name = 'SBUS 100000 baud 8E2 TxLink';
  public protocol: 'SBUS' = 'SBUS';
  private portPath: string;
  private openState = false;
  private errorCount = 0;
  private lastFrame: Uint8Array | null = null;
  private serialInstance: any = null;

  constructor(portPath = 'COM4') {
    this.portPath = portPath;
  }

  async open(): Promise<void> {
    try {
      // @ts-ignore
      const { SerialPort } = await import('serialport');
      this.serialInstance = new SerialPort({
        path: this.portPath,
        baudRate: 100000,
        dataBits: 8,
        parity: 'even',
        stopBits: 2,
        autoOpen: true
      });
      this.openState = true;
      console.log(`[SBUS] Opened serial port ${this.portPath} at 100000 8E2`);
    } catch (err: any) {
      console.warn(`[SBUS] SerialPort unavailable (${err.message}). Virtual mode active.`);
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
      const frame = encodeSbusFrame(channels);
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

import { TxLink } from './TxLink.js';

// CRSF Constants
const CRSF_ADDRESS_TRANSMITTER = 0xEE;
const CRSF_FRAMETYPE_RC_CHANNELS_PACKED = 0x16;

// CRC8 lookup table (polynomial 0xD5)
const CRC8_TAB = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  let curr = i;
  for (let j = 0; j < 8; j++) {
    if ((curr & 0x80) !== 0) {
      curr = ((curr << 1) ^ 0xD5) & 0xFF;
    } else {
      curr = (curr << 1) & 0xFF;
    }
  }
  CRC8_TAB[i] = curr;
}

export function calcCrsfCrc(data: Uint8Array, start: number, len: number): number {
  let crc = 0;
  for (let i = start; i < start + len; i++) {
    crc = CRC8_TAB[crc ^ data[i]];
  }
  return crc;
}

/**
 * Packs 16 PWM channel values (1000..2000 us) into a 26-byte CRSF RC frame.
 */
export function encodeCrsfFrame(channels: number[]): Uint8Array {
  const frame = new Uint8Array(26);
  frame[0] = CRSF_ADDRESS_TRANSMITTER; // 0xEE
  frame[1] = 24;                       // Length: type(1) + payload(22) + crc(1)
  frame[2] = CRSF_FRAMETYPE_RC_CHANNELS_PACKED; // 0x16

  // Convert PWM 1000..2000 us to 11-bit CRSF scale (172..1811)
  const crsfChannels = new Uint16Array(16);
  for (let i = 0; i < 16; i++) {
    const pwm = channels[i] !== undefined ? channels[i] : 1500;
    const clamped = Math.max(988, Math.min(2012, pwm));
    // 988 us -> 172, 1500 us -> 992, 2012 us -> 1811
    crsfChannels[i] = Math.round(((clamped - 988) * 1639) / 1024 + 172) & 0x07FF;
  }

  // Pack 16 11-bit integers into 22 bytes (indices 3..24)
  const ch = crsfChannels;
  frame[3]  = (ch[0] & 0xFF);
  frame[4]  = ((ch[0] >> 8) | (ch[1] << 3)) & 0xFF;
  frame[5]  = ((ch[1] >> 5) | (ch[2] << 6)) & 0xFF;
  frame[6]  = ((ch[2] >> 2)) & 0xFF;
  frame[7]  = ((ch[2] >> 10) | (ch[3] << 1)) & 0xFF;
  frame[8]  = ((ch[3] >> 7) | (ch[4] << 4)) & 0xFF;
  frame[9]  = ((ch[4] >> 4) | (ch[5] << 7)) & 0xFF;
  frame[10] = ((ch[5] >> 1)) & 0xFF;
  frame[11] = ((ch[5] >> 9) | (ch[6] << 2)) & 0xFF;
  frame[12] = ((ch[6] >> 6) | (ch[7] << 5)) & 0xFF;
  frame[13] = ((ch[7] >> 3)) & 0xFF;
  frame[14] = (ch[8] & 0xFF);
  frame[15] = ((ch[8] >> 8) | (ch[9] << 3)) & 0xFF;
  frame[16] = ((ch[9] >> 5) | (ch[10] << 6)) & 0xFF;
  frame[17] = ((ch[10] >> 2)) & 0xFF;
  frame[18] = ((ch[10] >> 10) | (ch[11] << 1)) & 0xFF;
  frame[19] = ((ch[11] >> 7) | (ch[12] << 4)) & 0xFF;
  frame[20] = ((ch[12] >> 4) | (ch[13] << 7)) & 0xFF;
  frame[21] = ((ch[13] >> 1)) & 0xFF;
  frame[22] = ((ch[13] >> 9) | (ch[14] << 2)) & 0xFF;
  frame[23] = ((ch[14] >> 6) | (ch[15] << 5)) & 0xFF;
  frame[24] = ((ch[15] >> 3)) & 0xFF;

  // CRC8 over type (frame[2]) and payload (frame[3..24]) -> 23 bytes
  frame[25] = calcCrsfCrc(frame, 2, 23);
  return frame;
}

export class CrsfTxLink implements TxLink {
  public name = 'CRSF USB-Serial TxLink';
  public protocol: 'CRSF' = 'CRSF';
  private portPath: string;
  private baudRate: number;
  private openState = false;
  private errorCount = 0;
  private lastFrame: Uint8Array | null = null;
  private serialInstance: any = null;

  constructor(portPath = 'COM3', baudRate = 420000) {
    this.portPath = portPath;
    this.baudRate = baudRate;
  }

  async open(): Promise<void> {
    try {
      // Dynamically load serialport if available
      // @ts-ignore
      const { SerialPort } = await import('serialport');
      this.serialInstance = new SerialPort({
        path: this.portPath,
        baudRate: this.baudRate,
        autoOpen: true
      });
      this.openState = true;
      console.log(`[CRSF] Opened serial port ${this.portPath} at ${this.baudRate} baud`);
    } catch (err: any) {
      console.warn(`[CRSF] SerialPort unavailable (${err.message}). Operating in virtual mode.`);
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
      const frame = encodeCrsfFrame(channels);
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

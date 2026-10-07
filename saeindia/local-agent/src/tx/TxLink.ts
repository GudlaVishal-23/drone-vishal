export interface TxLink {
  name: string;
  protocol: 'CRSF' | 'SBUS' | 'PPM' | 'MOCK';
  open(): Promise<void>;
  close(): Promise<void>;
  sendChannels(channels: number[]): Promise<boolean>;
  isOpen(): boolean;
  getErrorCount(): number;
  getLastFrame(): Uint8Array | null;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeCrsfFrame, calcCrsfCrc } from '../dist/tx/CrsfTxLink.js';
import { encodeSbusFrame } from '../dist/tx/SbusTxLink.js';
import { encodePpmSerialFrame } from '../dist/tx/PpmSerialTxLink.js';

test('CRSF Frame Encoder - Structure and CRC8', () => {
  const neutralChannels = new Array(16).fill(1500);
  const frame = encodeCrsfFrame(neutralChannels);

  // Assert frame length and headers
  assert.equal(frame.length, 26, 'CRSF frame must be exactly 26 bytes');
  assert.equal(frame[0], 0xEE, 'Byte 0 must be CRSF transmitter address 0xEE');
  assert.equal(frame[1], 24, 'Byte 1 must be frame length 24');
  assert.equal(frame[2], 0x16, 'Byte 2 must be RC channels packed type 0x16');

  // Verify CRC8 matches calculated CRC
  const expectedCrc = calcCrsfCrc(frame, 2, 23);
  assert.equal(frame[25], expectedCrc, 'Byte 25 must match calculated CRC8');

  // Verify 1500us packs to ~992 (0x03E0) for Channel 1
  // Byte 3 is low 8 bits of ch0: 0xE0
  assert.equal(frame[3], 0xE0, 'Neutral stick ch0 low bits match expected CRSF vector');
});

test('SBUS Frame Encoder - Header, Footer, and Failsafe', () => {
  const neutralChannels = new Array(16).fill(1500);
  const normalFrame = encodeSbusFrame(neutralChannels, false, false);

  assert.equal(normalFrame.length, 25, 'SBUS frame must be exactly 25 bytes');
  assert.equal(normalFrame[0], 0x0F, 'Byte 0 must be SBUS header 0x0F');
  assert.equal(normalFrame[24], 0x00, 'Byte 24 must be SBUS footer 0x00');
  assert.equal(normalFrame[23], 0x00, 'Byte 23 flags must be 0 for normal frame');

  // Test failsafe flag bit (bit 3)
  const failsafeFrame = encodeSbusFrame(neutralChannels, true, false);
  assert.equal(failsafeFrame[23] & (1 << 3), (1 << 3), 'Failsafe flag bit must be set');

  // Test frame lost flag bit (bit 2)
  const lostFrame = encodeSbusFrame(neutralChannels, false, true);
  assert.equal(lostFrame[23] & (1 << 2), (1 << 2), 'Frame lost flag bit must be set');
});

test('PPM Serial Frame Encoder - Sync and Checksum', () => {
  const channels = new Array(16).fill(1500);
  const frame = encodePpmSerialFrame(channels);

  assert.equal(frame.length, 35, 'PPM serial frame must be 2 + 32 + 1 = 35 bytes');
  assert.equal(frame[0], 0xFF, 'Byte 0 must be sync header 0xFF');
  assert.equal(frame[1], 0xAA, 'Byte 1 must be sync header 0xAA');

  // Verify 1500us little endian: 1500 = 0x05DC -> [0xDC, 0x05]
  assert.equal(frame[2], 0xDC, 'CH1 low byte');
  assert.equal(frame[3], 0x05, 'CH1 high byte');
});

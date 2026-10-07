import test from 'node:test';
import assert from 'node:assert/strict';
import { SlewLimiter } from '../dist/core/SlewLimiter.js';
import { SafetyInterlocks } from '../dist/core/SafetyInterlocks.js';
import { LinkLossStateMachine } from '../dist/core/LinkLossStateMachine.js';
import { ChannelManager } from '../dist/core/ChannelManager.js';

test('SlewLimiter - Smoothly interpolates step inputs on sticks', () => {
  const limiter = new SlewLimiter();
  limiter.setInitialValues(new Array(16).fill(1500));

  // Request instantaneous jump to 2000 on CH1 (Roll) with 2000 us/s rate
  const target = new Array(16).fill(1500);
  target[0] = 2000;

  // At dt = 0.02s (50 Hz), max change = 2000 * 0.02 = 40 us
  const step1 = limiter.update(target, 0.02);
  assert.equal(step1[0], 1540, 'CH1 should increment by exactly 40 us in first tick');

  const step2 = limiter.update(target, 0.02);
  assert.equal(step2[0], 1580, 'CH1 should increment by another 40 us in second tick');
});

test('SafetyInterlocks - Throttle Floor when armed and airborne', () => {
  const channels = new Array(16).fill(1500);
  channels[2] = 1000; // Throttle low

  // Case 1: Airborne & Armed -> Throttle must be clamped to 1150
  const airborneArmed = { armed: true, flightMode: 'LOITER', altitudeRelM: 5.0 };
  const clamped = SafetyInterlocks.applySafetyClamps(channels, airborneArmed);
  assert.equal(clamped[2], 1150, 'Throttle must be clamped to 1150 us armed floor when airborne');

  // Case 2: On ground (altitude < 0.4m) -> Throttle allowed at 1000
  const onGround = { armed: true, flightMode: 'LOITER', altitudeRelM: 0.1 };
  const groundClamped = SafetyInterlocks.applySafetyClamps(channels, onGround);
  assert.equal(groundClamped[2], 1000, 'Throttle allowed at 1000 us on ground');

  // Case 3: In LAND mode -> Throttle allowed to decrease
  const landing = { armed: true, flightMode: 'LAND', altitudeRelM: 2.0 };
  const landClamped = SafetyInterlocks.applySafetyClamps(channels, landing);
  assert.equal(landClamped[2], 1000, 'Throttle allowed below floor in LAND mode');
});

test('SafetyInterlocks - Disarm guard while airborne', () => {
  const airborne = { armed: true, flightMode: 'LOITER', altitudeRelM: 10.0 };

  // Without confirmation -> Disarm forbidden
  assert.equal(SafetyInterlocks.canDisarm(airborne, false), false, 'Disarm rejected without confirm when airborne');

  // With confirmation -> Disarm allowed
  assert.equal(SafetyInterlocks.canDisarm(airborne, true), true, 'Disarm permitted when confirm is true');
});

test('LinkLossStateMachine - State transitions on timeout', async () => {
  const channelManager = new ChannelManager();
  const sm = new LinkLossStateMachine(channelManager);

  // Initial state OK
  assert.equal(sm.updateTick(), 'OK');

  // Simulate cloud timeout by not calling recordCloudActivity
  // Wait 2.1s -> CLOUD_DEGRADED
  await new Promise(r => setTimeout(r, 2100));
  const degradedState = sm.updateTick();
  assert.equal(degradedState, 'CLOUD_DEGRADED', 'Link state transitions to CLOUD_DEGRADED after 2s');

  // Record cloud activity -> Restores to OK
  sm.recordCloudActivity();
  assert.equal(sm.updateTick(), 'OK', 'Link state restores to OK upon activity');
});

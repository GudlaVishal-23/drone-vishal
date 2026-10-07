import readline from 'readline';
import { TxLink } from './tx/TxLink.js';
import { CrsfTxLink } from './tx/CrsfTxLink.js';
import { SbusTxLink } from './tx/SbusTxLink.js';
import { PpmSerialTxLink } from './tx/PpmSerialTxLink.js';
import { MockTxLink } from './tx/MockTxLink.js';

import { ChannelManager } from './core/ChannelManager.js';
import { SlewLimiter } from './core/SlewLimiter.js';
import { ScriptEngine } from './core/ScriptEngine.js';
import { SafetyInterlocks } from './core/SafetyInterlocks.js';
import { LinkLossStateMachine } from './core/LinkLossStateMachine.js';
import { CloudApiClient } from './client/CloudApiClient.js';
import { TelemetryBridge } from './client/TelemetryBridge.js';

// Configuration from environment
const CLOUD_URL = process.env.CLOUD_URL || 'http://localhost:8443';
const RELAY_TOKEN = process.env.RELAY_AUTH_TOKEN || process.env.RELAY_TOKEN || '';
const TX_PROTOCOL = (process.env.TX_PROTOCOL || 'MOCK').toUpperCase();
const TX_PORT = process.env.TX_PORT || 'COM3';
const LOOP_RATE_HZ = parseInt(process.env.LOOP_RATE_HZ || '50', 10);
const LOOP_INTERVAL_MS = Math.round(1000 / LOOP_RATE_HZ);

console.log(`=======================================================`);
console.log(`🎮 SAE INDIA LAPTOP RC-AGENT RUNNING`);
console.log(`☁️  Cloud URL:         ${CLOUD_URL}`);
console.log(`📡 TX Protocol:       ${TX_PROTOCOL}`);
console.log(`🔌 TX Port:           ${TX_PORT}`);
console.log(`⏱️  Loop Rate:         ${LOOP_RATE_HZ} Hz (${LOOP_INTERVAL_MS}ms period)`);
console.log(`🛑 Local Override:    Press SPACE or 'k' to emergency neutralize`);
console.log(`=======================================================`);

// 1. Initialize Subsystems
const channelManager = new ChannelManager();
const slewLimiter = new SlewLimiter();
const scriptEngine = new ScriptEngine(channelManager);
const linkLoss = new LinkLossStateMachine(channelManager);
const telemetryBridge = new TelemetryBridge();
const cloudClient = new CloudApiClient(CLOUD_URL, RELAY_TOKEN);

// 2. Select TxLink implementation
let txLink: TxLink;
if (TX_PROTOCOL === 'CRSF') {
  txLink = new CrsfTxLink(TX_PORT);
} else if (TX_PROTOCOL === 'SBUS') {
  txLink = new SbusTxLink(TX_PORT);
} else if (TX_PROTOCOL === 'PPM') {
  txLink = new PpmSerialTxLink(TX_PORT);
} else {
  txLink = new MockTxLink();
}

// 3. Setup Command Dispatcher from Cloud
cloudClient.setOnCommand(async (cmd) => {
  linkLoss.recordCloudActivity();
  console.log(`[AGENT] Received command from cloud: id=${cmd.id} type=${cmd.type}`);

  // Report ACCEPTED
  await cloudClient.sendAck({
    commandId: cmd.id,
    status: 'ACCEPTED',
    statusMessage: `Command accepted by RC-Agent at ${new Date().toISOString()}`,
    timestamp: Date.now()
  });

  const aircraft = telemetryBridge.getStatus();
  const execResult = scriptEngine.executeCommand(cmd, aircraft);

  if (execResult.status === 'REJECTED') {
    await cloudClient.sendAck({
      commandId: cmd.id,
      status: 'REJECTED',
      statusMessage: execResult.message,
      timestamp: Date.now()
    });
  }
});

// 4. Setup Keyboard Emergency Stop (SPACE key / 'k')
if (process.stdin.isTTY) {
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.on('keypress', (str, key) => {
    if (key.ctrl && key.name === 'c') {
      process.exit();
    }
    if (str === ' ' || key.name === 'k') {
      linkLoss.triggerManualOverride('KEYBOARD EMERGENCY STOP (SPACE PRESSED)');
    }
  });
}

// 5. Start TX Link & Cloud Polling
await txLink.open();
cloudClient.startPolling();

// 6. 50 Hz Fixed-Rate Deterministic Control Loop
let lastTickTime = performance.now();
let lastTelemetryReport = Date.now();
let frameCount = 0;
let jitterAccumulator = 0;

setInterval(async () => {
  const now = performance.now();
  const dtSeconds = (now - lastTickTime) / 1000;
  const actualPeriodMs = now - lastTickTime;
  const jitter = Math.abs(actualPeriodMs - LOOP_INTERVAL_MS);
  jitterAccumulator += jitter;
  frameCount++;
  lastTickTime = now;

  // A. Link-Loss & Failsafe Watchdog Tick
  const agentState = linkLoss.updateTick();

  // B. Script Execution Progress & Closed-Loop Telemetry Check
  const aircraft = telemetryBridge.getStatus();
  const scriptProgress = scriptEngine.updateTick(aircraft);
  if (scriptProgress && scriptProgress.status === 'DONE') {
    await cloudClient.sendAck({
      commandId: scriptProgress.commandId,
      status: 'DONE',
      statusMessage: scriptProgress.message,
      timestamp: Date.now(),
      telemetrySnapshot: aircraft
    });
    scriptEngine.clearActiveExecution();
  }

  // C. Rate Limiting / Slew Limiter on Sticks
  const targetChannels = channelManager.getTargetChannels();
  const slewedChannels = slewLimiter.update(targetChannels, dtSeconds);

  // D. Safety Clamps (Throttle Floor when armed, airborne checks)
  const clampedChannels = SafetyInterlocks.applySafetyClamps(slewedChannels, aircraft);

  // E. Transmit complete 16-channel frame to TX
  await txLink.sendChannels(clampedChannels);

  // F. Periodic Telemetry Report to Cloud (1 Hz)
  if (Date.now() - lastTelemetryReport >= 1000) {
    const avgJitter = frameCount > 0 ? (jitterAccumulator / frameCount) : 0;
    jitterAccumulator = 0;
    frameCount = 0;
    lastTelemetryReport = Date.now();

    await cloudClient.sendTelemetry({
      channels: clampedChannels,
      loopRateHz: LOOP_RATE_HZ,
      jitterMs: parseFloat(avgJitter.toFixed(2)),
      serialErrors: txLink.getErrorCount(),
      cloudRttMs: cloudClient.getRttMs(),
      linkState: agentState,
      timestamp: Date.now(),
      txPort: TX_PORT,
      txProtocol: TX_PROTOCOL,
      aircraft,
      activeScript: scriptEngine.getActiveExecution()?.type
    });
  }
}, LOOP_INTERVAL_MS);

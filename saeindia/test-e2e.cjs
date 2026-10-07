const WebSocket = require('./relay-server/node_modules/ws');
const { spawn } = require('child_process');
const http = require('http');

console.log('=======================================================');
console.log('🚀 SAE INDIA E2E VERIFICATION: MAVLINK + RC-BRIDGE');
console.log('=======================================================');

const RELAY_PORT = '8765';
const RELAY_TOKEN = 'e2e-secret-key-456';

// 1. Launch Cloud Relay & RC-Bridge API
const relay = spawn('node', ['relay-server/server.js'], {
  env: { ...process.env, PORT: RELAY_PORT, RELAY_TOKEN, RELAY_AUTH_TOKEN: RELAY_TOKEN }
});

relay.stdout.on('data', d => console.log('[RELAY]', d.toString().trim()));
relay.stderr.on('data', d => console.error('[RELAY ERROR]', d.toString().trim()));

// 2. Start Mock ESP32 Server on 8088
const mockEsp32Wss = new WebSocket.Server({ port: 8088 });
let mockEsp32Client = null;

mockEsp32Wss.on('connection', (ws) => {
  mockEsp32Client = ws;
  console.log('[MOCK ESP32] Local connector connected to mock ESP32.');
  
  const sendTelemetry = () => {
    if (ws.readyState === WebSocket.OPEN) {
      const telemetryFrame = Buffer.from([0xFD, 0x09, 0x00, 0x00, 0x02, 0x01, 0x01, 0x00, 0x00, 0x00, 0x06, 0x08, 0x00, 0x00, 0x00, 0x03, 0x85, 0x47, 0x5a]);
      ws.send(telemetryFrame);
    }
  };
  sendTelemetry();
  const simTimer = setInterval(sendTelemetry, 500);
  ws.on('close', () => clearInterval(simTimer));
  ws.on('message', (msg) => {
    console.log('[MOCK ESP32] Received uplink command from connector, length:', msg.length);
  });
});

setTimeout(async () => {
  console.log('\n[TEST 1] Testing Cloud REST API & Health Check...');
  const healthOk = await new Promise((res) => {
    http.get(`http://localhost:${RELAY_PORT}/health`, (r) => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => {
        const body = JSON.parse(d);
        console.log('[API HEALTH]', r.statusCode, body.service, 'RC Bridge Ready:', Boolean(body.rcBridge));
        res(r.statusCode === 200);
      });
    }).on('error', () => res(false));
  });

  // 3. Connect Browser client to Relay
  console.log('\n[TEST 2] Connecting Browser client to Relay /ws?token=...');
  const browserWs = new WebSocket(`ws://localhost:${RELAY_PORT}/ws?token=${RELAY_TOKEN}`);
  browserWs.binaryType = 'arraybuffer';

  let binaryPacketsReceived = 0;
  let controlMessagesReceived = [];

  browserWs.on('open', () => {
    console.log('[BROWSER] WebSocket connected to relay endpoint successfully.');

    // 4. Launch Local Connector
    console.log('\n[TEST 3] Launching Local Connector pointing to mock ESP32 & Relay...');
    const connector = spawn('node', ['local-connector/connector.js'], {
      env: {
        ...process.env,
        ESP32_HOST: '127.0.0.1',
        ESP32_PORT: '8088',
        ESP32_PATH: '/ws',
        RELAY_URL: `ws://localhost:${RELAY_PORT}/connector`,
        RELAY_TOKEN
      }
    });

    connector.stdout.on('data', d => console.log('[CONNECTOR]', d.toString().trim()));
    connector.stderr.on('data', d => console.error('[CONNECTOR ERROR]', d.toString().trim()));

    // 5. Test Secondary RC-Bridge Pipeline
    setTimeout(async () => {
      console.log('\n[TEST 4] Testing Secondary RC-Bridge Command Injection & Encoders...');
      
      // Load agent modules directly to test in-process simulation
      const { ChannelManager } = await import('./local-agent/dist/core/ChannelManager.js');
      const { ScriptEngine } = await import('./local-agent/dist/core/ScriptEngine.js');
      const { MockTxLink } = await import('./local-agent/dist/tx/MockTxLink.js');
      const { LinkLossStateMachine } = await import('./local-agent/dist/core/LinkLossStateMachine.js');

      const channelManager = new ChannelManager();
      const mockTx = new MockTxLink();
      await mockTx.open();
      const scriptEngine = new ScriptEngine(channelManager);
      const linkLoss = new LinkLossStateMachine(channelManager);

      // Issue command via Cloud REST API: POST /api/v1/command
      const commandId = '22222222-3333-4444-5555-666666666666';
      const cmdPayload = JSON.stringify({
        id: commandId,
        type: 'SET_MODE',
        params: { mode: 'RTL' },
        issuedAt: Date.now(),
        ttlMs: 5000,
        nonce: 'nonce-rc-bridge-e2e'
      });

      console.log('[RC-BRIDGE TEST] Posting SET_MODE RTL command to Cloud API...');
      const postResult = await new Promise((res, rej) => {
        const req = http.request(`http://localhost:${RELAY_PORT}/api/v1/command`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RELAY_TOKEN}`
          }
        }, (r) => {
          let d = ''; r.on('data', c => d += c);
          r.on('end', () => res({ status: r.statusCode, body: JSON.parse(d) }));
        });
        req.on('error', rej);
        req.write(cmdPayload);
        req.end();
      });

      console.log('[RC-BRIDGE TEST] Cloud Response:', postResult.status, postResult.body.status);

      // Simulate Agent polling the command: GET /api/v1/agent/poll
      const pollResult = await new Promise((res, rej) => {
        http.get(`http://localhost:${RELAY_PORT}/api/v1/agent/poll?timeout=500`, {
          headers: { 'Authorization': `Bearer ${RELAY_TOKEN}` }
        }, (r) => {
          let d = ''; r.on('data', c => d += c);
          r.on('end', () => res(JSON.parse(d)));
        }).on('error', rej);
      });

      console.log('[RC-BRIDGE TEST] Agent Polled Commands Count:', pollResult.commands?.length);
      const receivedCmd = pollResult.commands?.[0];

      // Execute in ScriptEngine
      if (receivedCmd) {
        scriptEngine.executeCommand(receivedCmd, { armed: true, flightMode: 'LOITER', altitudeRelM: 10 });
        console.log('[RC-BRIDGE TEST] CH5 Target PWM:', channelManager.getChannel(5)); // Expected: 1685 (RTL)

        // Transmit through MockTxLink with CRSF encoding
        await mockTx.sendChannels(channelManager.getTargetChannels());
        const crsfFrame = mockTx.getLastFrame();
        console.log('[RC-BRIDGE TEST] MockTxLink received frame length:', crsfFrame.length, 'Header:', '0x' + crsfFrame[0].toString(16));
        
        // Assertions
        const isCrsfValid = crsfFrame.length === 26 && crsfFrame[0] === 0xEE;
        const isRtlPwm = channelManager.getChannel(5) === 1685;
        console.log('[RC-BRIDGE TEST] Frame Valid:', isCrsfValid, '| RTL PWM Valid:', isRtlPwm);

        // Report ACK to Cloud API
        await new Promise((res, rej) => {
          const req = http.request(`http://localhost:${RELAY_PORT}/api/v1/agent/ack`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${RELAY_TOKEN}`
            }
          }, (r) => res(r.statusCode));
          req.on('error', rej);
          req.write(JSON.stringify({ commandId, status: 'DONE', timestamp: Date.now() }));
          req.end();
        });

        // Test Link-Loss State Machine Failsafe
        console.log('[RC-BRIDGE TEST] Testing Link-Loss state machine...');
        linkLoss.recordCloudActivity();
        console.log('[RC-BRIDGE TEST] Initial state:', linkLoss.updateTick()); // OK
      }

      // Summary & Cleanup
      setTimeout(() => {
        console.log('\n=======================================================');
        console.log('🏁 COMPLETE E2E TEST SUMMARY');
        console.log('=======================================================');
        console.log('Health Check Passed:                 ', healthOk);
        console.log('Binary MAVLink Frames Received:      ', binaryPacketsReceived);
        console.log('Control Messages Received:           ', controlMessagesReceived.length);
        console.log('RC-Bridge Command Queue & Poll:      ', pollResult.commands?.length === 1);
        console.log('CRSF Channel Encoder Frame Output:   ', mockTx.totalFramesSent > 0);
        
        const allPassed = healthOk && binaryPacketsReceived > 0 && pollResult.commands?.length === 1 && mockTx.totalFramesSent > 0;
        console.log('Overall Test Verdict:               ', allPassed ? 'ALL TESTS PASSED (EXIT 0)' : 'FAILED');
        console.log('=======================================================');

        browserWs.close();
        connector.kill();
        relay.kill();
        mockEsp32Wss.close();
        process.exit(allPassed ? 0 : 1);
      }, 1000);
    }, 1500);
  });

  browserWs.on('message', (data, isBinary) => {
    if (!isBinary) {
      controlMessagesReceived.push(data.toString());
    } else {
      binaryPacketsReceived++;
      const bytes = new Uint8Array(data);
      if (binaryPacketsReceived <= 2) {
        console.log(`[BROWSER] Received Binary MAVLink Frame #${binaryPacketsReceived}: len=${bytes.length}`);
      }
    }
  });
}, 1000);

import { logAuditEvent } from './auditLogger.js';

const commands = new Map();
const nonces = new Map();
const NONCE_WINDOW_MS = 5 * 60 * 1000; // 5 minute replay window

let pendingQueue = [];
const longPollWaiters = new Set();
const sseClients = new Set();

let latestAgentTelemetry = null;
let agentLastSeen = 0;
let commandsProcessedCount = 0;

// Periodic cleanup of expired nonces and stale command records (older than 1 hour)
setInterval(() => {
  const now = Date.now();
  for (const [nonce, ts] of nonces.entries()) {
    if (now - ts > NONCE_WINDOW_MS) {
      nonces.delete(nonce);
    }
  }

  // Mark expired commands that were never picked up
  for (const record of commands.values()) {
    if (record.status === 'QUEUED' && now - record.command.issuedAt > record.command.ttlMs) {
      record.status = 'EXPIRED';
      record.statusMessage = 'Command expired in queue before delivery';
      record.updatedAt = now;
    }
  }
}, 30000);

export function enqueueCommand(cmd, operatorId = 'anon', clientIp = 'unknown') {
  const now = Date.now();

  // 1. Replay Protection: Check Nonce
  if (nonces.has(cmd.nonce)) {
    logAuditEvent({
      action: 'REPLAY_REJECTED',
      commandId: cmd.id,
      type: cmd.type,
      operatorId,
      status: 'REJECTED',
      ip: clientIp,
      details: 'Nonce already used'
    });
    return { error: 'DUPLICATE_NONCE', status: 409, message: `Replay detected: nonce "${cmd.nonce}" has already been processed` };
  }

  // 2. TTL Expiration Check
  if (now - cmd.issuedAt > cmd.ttlMs) {
    logAuditEvent({
      action: 'TTL_REJECTED',
      commandId: cmd.id,
      type: cmd.type,
      operatorId,
      status: 'REJECTED',
      ip: clientIp,
      details: 'Command expired'
    });
    return { error: 'EXPIRED_COMMAND', status: 400, message: `Command expired: age ${now - cmd.issuedAt}ms exceeds ttlMs ${cmd.ttlMs}ms` };
  }

  // 3. Idempotency Check: Same ID
  if (commands.has(cmd.id)) {
    const existing = commands.get(cmd.id);
    if (existing.command.type === cmd.type && existing.command.nonce === cmd.nonce) {
      return { ok: true, record: existing, idempotent: true };
    }
    return { error: 'ID_CONFLICT', status: 409, message: `Command ID ${cmd.id} already exists with different payload` };
  }

  // Store Nonce
  nonces.set(cmd.nonce, now);

  // High-Severity Safety Checks
  if (cmd.type === 'KILL') {
    if (!cmd.params || cmd.params.confirm !== true) {
      return { error: 'SAFETY_REJECTED', status: 400, message: 'KILL command requires explicit { confirm: true, reason: string }' };
    }
  }

  const record = {
    command: { ...cmd, operatorId },
    status: 'QUEUED',
    statusMessage: 'Queued in cloud relay for agent dispatch',
    createdAt: now,
    updatedAt: now
  };

  commands.set(cmd.id, record);
  pendingQueue.push(record);
  commandsProcessedCount++;

  logAuditEvent({
    action: 'COMMAND_QUEUED',
    commandId: cmd.id,
    type: cmd.type,
    operatorId,
    status: 'QUEUED',
    ip: clientIp
  });

  // Notify any pending Long-Poll waiters immediately
  wakeLongPollWaiters();

  // Notify SSE clients
  notifySseClients('command', record.command);

  return { ok: true, record, idempotent: false };
}

export function getCommand(id) {
  return commands.get(id) || null;
}

export function getAllCommands(limit = 50) {
  const all = Array.from(commands.values());
  return all.slice(-limit).reverse();
}

function wakeLongPollWaiters() {
  if (pendingQueue.length === 0 || longPollWaiters.size === 0) return;

  const toDeliver = [...pendingQueue];
  pendingQueue = [];
  const now = Date.now();

  for (const rec of toDeliver) {
    if (rec.status === 'QUEUED') {
      rec.status = 'DELIVERED';
      rec.deliveredAt = now;
      rec.updatedAt = now;
      rec.statusMessage = 'Delivered to RC-Agent';
    }
  }

  const payload = {
    commands: toDeliver.map(r => r.command),
    serverTimestamp: now
  };

  for (const waiter of longPollWaiters) {
    clearTimeout(waiter.timer);
    try {
      waiter.resolve(payload);
    } catch (e) {}
  }
  longPollWaiters.clear();
}

export function pollForAgent(timeoutMs = 25000) {
  // If we already have queued commands, return immediately
  if (pendingQueue.length > 0) {
    const toDeliver = [...pendingQueue];
    pendingQueue = [];
    const now = Date.now();

    for (const rec of toDeliver) {
      if (rec.status === 'QUEUED') {
        rec.status = 'DELIVERED';
        rec.deliveredAt = now;
        rec.updatedAt = now;
        rec.statusMessage = 'Delivered to RC-Agent';
      }
    }

    return Promise.resolve({
      commands: toDeliver.map(r => r.command),
      serverTimestamp: now
    });
  }

  // Otherwise, hold connection open up to timeoutMs
  return new Promise((resolve) => {
    const waiter = {
      resolve,
      timer: null
    };

    waiter.timer = setTimeout(() => {
      longPollWaiters.delete(waiter);
      resolve({
        commands: [],
        serverTimestamp: Date.now()
      });
    }, timeoutMs);

    longPollWaiters.add(waiter);
  });
}

export function registerSseClient(res) {
  sseClients.add(res);
  res.on('close', () => sseClients.delete(res));
}

function notifySseClients(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

export function ackCommand(ackPayload) {
  const { commandId, status, statusMessage, timestamp, telemetrySnapshot } = ackPayload;
  const record = commands.get(commandId);
  if (!record) {
    return { error: 'NOT_FOUND', status: 404, message: `Command ${commandId} not found` };
  }

  record.status = status;
  if (statusMessage) record.statusMessage = statusMessage;
  record.updatedAt = Date.now();
  if (status === 'DONE' || status === 'REJECTED' || status === 'EXPIRED') {
    record.completedAt = Date.now();
  }
  record.ackDetails = ackPayload;

  logAuditEvent({
    action: `COMMAND_${status}`,
    commandId,
    type: record.command.type,
    operatorId: record.command.operatorId,
    status,
    details: statusMessage
  });

  notifySseClients('ack', { commandId, status, statusMessage, timestamp });
  return { ok: true, record };
}

export function updateAgentTelemetry(telemetry) {
  latestAgentTelemetry = telemetry;
  agentLastSeen = Date.now();
  notifySseClients('telemetry', telemetry);
  return { ok: true };
}

export function getCloudState() {
  const now = Date.now();
  const agentLastSeenAgeMs = agentLastSeen > 0 ? (now - agentLastSeen) : 999999;
  const agentOnline = agentLastSeenAgeMs < 3500;

  // Find most recent command
  let lastCommand = null;
  const allCmds = Array.from(commands.values());
  if (allCmds.length > 0) {
    const latest = allCmds[allCmds.length - 1];
    lastCommand = {
      id: latest.command.id,
      type: latest.command.type,
      status: latest.status,
      updatedAt: latest.updatedAt
    };
  }

  return {
    agentOnline,
    agentLastSeenAgeMs,
    telemetry: latestAgentTelemetry,
    activeCommandsCount: pendingQueue.length,
    totalCommandsProcessed: commandsProcessedCount,
    lastCommand,
    serverTimestamp: now
  };
}

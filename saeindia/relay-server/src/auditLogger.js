// Structured audit logger for all RC commands and mission critical events

const MAX_AUDIT_LOGS = 500;
const auditRingBuffer = [];

export function logAuditEvent(event) {
  const entry = {
    timestamp: Date.now(),
    isoTime: new Date().toISOString(),
    ...event
  };

  auditRingBuffer.push(entry);
  if (auditRingBuffer.length > MAX_AUDIT_LOGS) {
    auditRingBuffer.shift();
  }

  // Structured console log
  console.log(`[AUDIT] [${entry.isoTime}] [${entry.action || 'EVENT'}] id=${entry.commandId || '-'} type=${entry.type || '-'} operator=${entry.operatorId || 'anon'} status=${entry.status || '-'} ip=${entry.ip || '-'}`);
}

export function getAuditLogs(limit = 100) {
  return auditRingBuffer.slice(-Math.min(limit, MAX_AUDIT_LOGS));
}

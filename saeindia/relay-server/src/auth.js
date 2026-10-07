// Authentication middleware for Cloud Command API & WebSocket Relay
// Strictly enforces Bearer token from environment variables.
// NEVER uses hardcoded fallback tokens in production.

const RELAY_TOKEN = (process.env.RELAY_AUTH_TOKEN || process.env.RELAY_TOKEN || '').trim();

if (!RELAY_TOKEN && process.env.NODE_ENV === 'production') {
  console.error('[SECURITY FATAL] RELAY_AUTH_TOKEN or RELAY_TOKEN environment variable must be set in production!');
}

export function validateAuthToken(tokenCandidate) {
  if (!RELAY_TOKEN) {
    // If running in development without any configured token, log caution
    if (process.env.NODE_ENV !== 'production') {
      return { ok: true, operatorId: 'dev-operator' };
    }
    return { ok: false, error: 'Server authentication unconfigured' };
  }

  if (!tokenCandidate || typeof tokenCandidate !== 'string') {
    return { ok: false, error: 'Missing authentication token' };
  }

  const cleanToken = tokenCandidate.trim();
  if (cleanToken === RELAY_TOKEN) {
    return { ok: true, operatorId: 'authenticated-operator' };
  }

  return { ok: false, error: 'Invalid authentication token' };
}

export function extractBearerToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const xToken = req.headers['x-relay-token'];
  if (xToken) {
    return String(xToken).trim();
  }
  return null;
}

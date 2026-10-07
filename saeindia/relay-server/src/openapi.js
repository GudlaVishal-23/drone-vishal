export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "SAE INDIA Drone RC-Bridge Cloud Command API",
    description: "High-integrity, replay-protected cloud command and telemetry API for the SAE INDIA Autonomous Drone Rescue & QR Mission System RC-Bridge.",
    version: "1.0.0"
  },
  servers: [
    { url: "/api/v1", description: "Production / Local Cloud Relay" }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT or Static Security Token"
      }
    },
    schemas: {
      CommandType: {
        type: "string",
        enum: ["ARM", "DISARM", "SET_MODE", "TAKEOFF", "RTL", "LAND", "HOLD", "NUDGE", "SET_ALTITUDE_HOLD", "START_MISSION", "ABORT_MISSION", "EMERGENCY_RTL", "KILL", "GIMBAL", "HEARTBEAT"]
      },
      CommandStatus: {
        type: "string",
        enum: ["QUEUED", "DELIVERED", "ACCEPTED", "EXECUTING", "DONE", "REJECTED", "EXPIRED"]
      },
      RcCommand: {
        type: "object",
        required: ["id", "type", "issuedAt", "ttlMs", "nonce"],
        properties: {
          id: { type: "string", format: "uuid" },
          type: { $ref: "#/components/schemas/CommandType" },
          params: { type: "object", additionalProperties: true },
          issuedAt: { type: "integer", format: "int64" },
          ttlMs: { type: "integer" },
          nonce: { type: "string" },
          operatorId: { type: "string" }
        }
      },
      CommandAckPayload: {
        type: "object",
        required: ["commandId", "status", "timestamp"],
        properties: {
          commandId: { type: "string", format: "uuid" },
          status: { $ref: "#/components/schemas/CommandStatus" },
          statusMessage: { type: "string" },
          timestamp: { type: "integer", format: "int64" }
        }
      },
      AgentTelemetry: {
        type: "object",
        required: ["channels", "loopRateHz", "jitterMs", "serialErrors", "cloudRttMs", "linkState", "timestamp"],
        properties: {
          channels: { type: "array", items: { type: "integer" } },
          loopRateHz: { type: "number" },
          jitterMs: { type: "number" },
          serialErrors: { type: "integer" },
          cloudRttMs: { type: "number" },
          lastCommandId: { type: "string", format: "uuid" },
          linkState: { type: "string", enum: ["OK", "CLOUD_DEGRADED", "CLOUD_LOST", "TX_SERIAL_LOST", "FAILSAFE_RTL", "MANUAL_OVERRIDE"] },
          timestamp: { type: "integer", format: "int64" }
        }
      }
    }
  },
  security: [{ BearerAuth: [] }],
  paths: {
    "/command": {
      post: {
        summary: "Issue a new high-level drone flight command",
        description: "Replay-protected and idempotent. Verified against nonce and TTL before enqueuing.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/RcCommand" } } }
        },
        responses: {
          "200": { description: "Command queued or existing idempotent record returned" },
          "400": { description: "Expired command or schema validation failure" },
          "409": { description: "Duplicate nonce or conflicting command ID" },
          "401": { description: "Unauthorized" }
        }
      }
    },
    "/command/{id}": {
      get: {
        summary: "Query status of a specific command by UUID",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }
        ],
        responses: {
          "200": { description: "Command record" },
          "404": { description: "Command not found" }
        }
      }
    },
    "/agent/poll": {
      get: {
        summary: "Long-poll endpoint for Laptop RC-Agent",
        description: "Holds connection up to 25s waiting for new commands. Returns array of commands.",
        responses: {
          "200": { description: "Array of delivered commands" }
        }
      }
    },
    "/agent/stream": {
      get: {
        summary: "Server-Sent Events (SSE) stream for real-time command delivery",
        responses: {
          "200": { description: "SSE stream (text/event-stream)" }
        }
      }
    },
    "/agent/ack": {
      post: {
        summary: "Report execution progress and completion status from RC-Agent",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CommandAckPayload" } } }
        },
        responses: {
          "200": { description: "Status acknowledged" }
        }
      }
    },
    "/agent/telemetry": {
      post: {
        summary: "Periodic telemetry report from Laptop RC-Agent (1-2 Hz)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/AgentTelemetry" } } }
        },
        responses: {
          "200": { description: "Telemetry recorded" }
        }
      }
    },
    "/state": {
      get: {
        summary: "Fetch latest consolidated RC link and telemetry state for GCS UI",
        responses: {
          "200": { description: "Consolidated state object" }
        }
      }
    }
  }
};

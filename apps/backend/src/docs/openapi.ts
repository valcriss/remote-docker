export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Remote Docker Backend API",
    version: "0.1.0",
    description: "Control plane API for sessions, catalog, instances, forwards and sync."
  },
  servers: [{ url: "http://localhost:4000" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    },
    schemas: {
      ApiSuccess: {
        type: "object",
        properties: {
          data: {},
          meta: { type: "object", additionalProperties: true },
          error: { type: "null" }
        }
      },
      ApiError: {
        type: "object",
        properties: {
          data: { type: "null" },
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              requestId: { type: "string" }
            },
            required: ["code", "message"]
          }
        },
        required: ["data", "error"]
      }
    }
  },
  paths: {
    "/health": {
      get: { summary: "Health check", responses: { "200": { description: "OK" } } }
    },
    "/api/auth/login": {
      post: {
        summary: "Login",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { email: { type: "string" }, password: { type: "string" } } } } }
        },
        responses: { "200": { description: "Logged in" }, "401": { description: "Invalid credentials" } }
      }
    },
    "/api/me/dashboard": {
      get: {
        summary: "User dashboard summary",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Dashboard payload" } }
      }
    },
    "/api/admin/dashboard": {
      get: {
        summary: "Admin dashboard summary",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Dashboard payload" }, "403": { description: "Admin only" } }
      }
    },
    "/api/catalog/templates": {
      get: { summary: "List templates", security: [{ bearerAuth: [] }], responses: { "200": { description: "Template list" } } },
      post: { summary: "Create template", security: [{ bearerAuth: [] }], responses: { "201": { description: "Template created" } } }
    },
    "/api/instances": {
      get: { summary: "List instances", security: [{ bearerAuth: [] }], responses: { "200": { description: "Instance list" } } },
      post: { summary: "Create instance", security: [{ bearerAuth: [] }], responses: { "201": { description: "Instance created" } } }
    },
    "/api/forwards": {
      get: { summary: "List forwards", security: [{ bearerAuth: [] }], responses: { "200": { description: "Forward list" } } },
      post: { summary: "Create forward", security: [{ bearerAuth: [] }], responses: { "201": { description: "Forward created" } } }
    },
    "/api/sync/start": {
      post: { summary: "Start sync", security: [{ bearerAuth: [] }], responses: { "200": { description: "Sync started" } } }
    }
  }
} as const;
import http from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";
import { AgentHub } from "./agent-hub.js";

interface SocketContext {
  userId: string;
  role: "USER" | "ADMIN";
}

const jwtSecret = process.env.JWT_SECRET ?? "dev-secret";

function parseToken(url: URL): string | undefined {
  const raw = url.searchParams.get("token");
  return raw ?? undefined;
}

function authorize(token: string): SocketContext | null {
  try {
    const payload = jwt.verify(token, jwtSecret) as { sub: string; role: "USER" | "ADMIN" };
    return { userId: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

async function onAgentMessage(userId: string, message: { type: string; payload: Record<string, unknown> }): Promise<void> {
  console.log(JSON.stringify({
    level: "info",
    message: "ws.agent.message",
    userId,
    type: message.type,
    payload: message.type === "ACK" ? message.payload : undefined
  }));

  if (message.type === "HELLO") {
    await prisma.session.upsert({
      where: { userId },
      create: {
        userId,
        status: "ONLINE",
        agentVersion: String(message.payload.agentVersion ?? "unknown"),
        hostname: String(message.payload.hostname ?? "unknown"),
        lastSeenAt: new Date()
      },
      update: {
        status: "ONLINE",
        agentVersion: String(message.payload.agentVersion ?? "unknown"),
        hostname: String(message.payload.hostname ?? "unknown"),
        lastSeenAt: new Date()
      }
    });
    return;
  }

  if (message.type === "HEARTBEAT") {
    await prisma.session.updateMany({ where: { userId }, data: { status: "ONLINE", lastSeenAt: new Date() } });
    await replayPendingForwards(userId, hubRef);
    return;
  }

  if (message.type === "ACK") {
    const id = String(message.payload.id ?? "");
    const status = String(message.payload.status ?? "");
    if (!id) {
      return;
    }

    if (status === "BOUND") {
      await prisma.portForward.updateMany({ where: { id, userId }, data: { status: "ACTIVE" } });
      return;
    }

    if (status === "UNBOUND") {
      await prisma.portForward.updateMany({ where: { id, userId }, data: { status: "STOPPED" } });
      return;
    }

    if (status === "ERROR") {
      await prisma.portForward.updateMany({ where: { id, userId }, data: { status: "ERROR" } });
      return;
    }
  }
}

async function replayPendingForwards(userId: string, hub: AgentHub): Promise<void> {
  const pending = await prisma.portForward.findMany({
    where: {
      userId,
      status: { in: ["REQUESTED", "AGENT_OFFLINE"] }
    },
    orderBy: { createdAt: "asc" }
  });

  for (const forward of pending) {
    const sent = hub.sendToAgent(userId, {
      type: "BIND_PORT",
      payload: {
        id: forward.id,
        localPort: forward.localPort,
        remoteHost: forward.remoteHost,
        remotePort: forward.remotePort
      }
    });

    if (sent && forward.status !== "REQUESTED") {
      await prisma.portForward.update({ where: { id: forward.id }, data: { status: "REQUESTED" } });
    }
  }

  if (pending.length > 0) {
    console.log(JSON.stringify({
      level: "info",
      message: "ws.agent.replayPendingForwards",
      userId,
      count: pending.length
    }));
  }
}

let hubRef: AgentHub;

export function setupWebSockets(server: http.Server): AgentHub {
  const hub = new AgentHub();
  hubRef = hub;
  hub.setOnAgentMessage(onAgentMessage);

  const agentWss = new WebSocketServer({ noServer: true });
  const frontendWss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const requestUrl = request.url ?? "/";
    const url = new URL(requestUrl, "http://localhost");

    const token = parseToken(url);
    if (!token) {
      socket.destroy();
      return;
    }

    const auth = authorize(token);
    if (!auth) {
      socket.destroy();
      return;
    }

    if (url.pathname === "/ws/agent") {
      agentWss.handleUpgrade(request, socket, head, (ws) => {
        agentWss.emit("connection", ws, auth);
      });
      return;
    }

    if (url.pathname === "/ws/frontend") {
      frontendWss.handleUpgrade(request, socket, head, (ws) => {
        frontendWss.emit("connection", ws, auth);
      });
      return;
    }

    socket.destroy();
  });

  agentWss.on("connection", async (ws: WebSocket, auth: SocketContext) => {
    console.log(JSON.stringify({ level: "info", message: "ws.agent.connected", userId: auth.userId }));
    hub.registerAgent(auth.userId, ws);

    await prisma.session.upsert({
      where: { userId: auth.userId },
      create: {
        userId: auth.userId,
        status: "ONLINE",
        agentVersion: "unknown",
        hostname: "unknown",
        lastSeenAt: new Date()
      },
      update: {
        status: "ONLINE",
        lastSeenAt: new Date()
      }
    });

    hub.broadcastToUser(auth.userId, { type: "SESSION_UPDATED", payload: { status: "ONLINE" } });
    await replayPendingForwards(auth.userId, hub);

    ws.on("message", async (raw) => {
      const message = JSON.parse(raw.toString()) as { type: string; payload?: Record<string, unknown> };
      await hub.handleAgentMessage(auth.userId, {
        type: message.type,
        payload: message.payload ?? {}
      });
    });

    ws.on("close", async () => {
      console.log(JSON.stringify({ level: "info", message: "ws.agent.disconnected", userId: auth.userId }));
      hub.unregisterAgent(auth.userId);
      await prisma.session.updateMany({
        where: { userId: auth.userId },
        data: { status: "OFFLINE", lastSeenAt: new Date() }
      });
      hub.broadcastToUser(auth.userId, { type: "SESSION_UPDATED", payload: { status: "OFFLINE" } });
    });
  });

  frontendWss.on("connection", (ws: WebSocket, auth: SocketContext) => {
    hub.registerFrontend(auth.userId, ws);

    ws.on("message", (raw) => {
      const message = JSON.parse(raw.toString()) as { type: string; payload: Record<string, unknown> };
      if (message.type === "FORWARD_REQUEST") {
        hub.sendToAgent(auth.userId, { type: "BIND_PORT", payload: message.payload });
      }
    });

    ws.on("close", () => {
      hub.unregisterFrontend(auth.userId, ws);
    });
  });

  return hub;
}

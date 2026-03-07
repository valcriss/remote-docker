import { WebSocket } from "ws";

interface AgentConnection {
  userId: string;
  ws: WebSocket;
}

export class AgentHub {
  private readonly agents = new Map<string, AgentConnection>();
  private readonly frontends = new Map<string, Set<WebSocket>>();
  private onAgentMessageHandler: ((userId: string, message: { type: string; payload: Record<string, unknown> }) => Promise<void>) | null = null;

  setOnAgentMessage(handler: (userId: string, message: { type: string; payload: Record<string, unknown> }) => Promise<void>): void {
    this.onAgentMessageHandler = handler;
  }

  registerAgent(userId: string, ws: WebSocket): void {
    this.agents.set(userId, { userId, ws });
  }

  unregisterAgent(userId: string): void {
    this.agents.delete(userId);
  }

  registerFrontend(userId: string, ws: WebSocket): void {
    if (!this.frontends.has(userId)) {
      this.frontends.set(userId, new Set());
    }
    this.frontends.get(userId)!.add(ws);
  }

  unregisterFrontend(userId: string, ws: WebSocket): void {
    const set = this.frontends.get(userId);
    if (!set) {
      return;
    }

    set.delete(ws);
    if (set.size === 0) {
      this.frontends.delete(userId);
    }
  }

  async handleAgentMessage(userId: string, message: { type: string; payload: Record<string, unknown> }): Promise<void> {
    if (this.onAgentMessageHandler) {
      await this.onAgentMessageHandler(userId, message);
    }

    this.broadcastToUser(userId, message);
  }

  sendToAgent(userId: string, command: { type: string; payload: Record<string, unknown> }): boolean {
    const connection = this.agents.get(userId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    connection.ws.send(JSON.stringify(command), (error) => {
      if (error) {
        console.warn(JSON.stringify({
          level: "warn",
          message: "ws.agent.send.error",
          userId,
          type: command.type,
          error: error.message
        }));
      } else {
        console.log(JSON.stringify({
          level: "info",
          message: "ws.agent.send.ok",
          userId,
          type: command.type
        }));
      }
    });
    return true;
  }

  broadcastToUser(userId: string, message: unknown): void {
    const sockets = this.frontends.get(userId);
    if (!sockets) {
      return;
    }

    const payload = JSON.stringify(message);
    for (const ws of sockets.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }
}

export type UserRole = "USER" | "ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface SessionState {
  id: string;
  userId: string;
  status: "ONLINE" | "OFFLINE";
  agentVersion: string;
  hostname: string;
  lastSeenAt: string;
}

export interface CatalogTemplateSummary {
  id: string;
  name: string;
  type: "CONTAINER" | "COMPOSE";
  description?: string;
}

export interface PortDeclaration {
  name: string;
  containerPort: number;
  protocol: "TCP";
  exposure: "INTERNAL" | "FORWARDABLE";
}

export interface VolumeDeclaration {
  name: string;
  mountPath: string;
  mode: "REMOTE_ONLY" | "SYNC_BIDIRECTIONAL";
  defaultConflictPolicy: "PREFER_LOCAL" | "PREFER_REMOTE" | "MANUAL";
}

export interface AgentCommand {
  id: string;
  type: "BIND_PORT" | "UNBIND_PORT" | "PING";
  payload: Record<string, unknown>;
}

export interface AgentEvent {
  type: "HELLO" | "HEARTBEAT" | "FORWARD_OPEN" | "FORWARD_CLOSE" | "FORWARD_DATA" | "ACK" | "ERROR";
  payload: Record<string, unknown>;
}

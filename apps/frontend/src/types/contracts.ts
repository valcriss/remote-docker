export type Role = "USER" | "ADMIN";

export interface CurrentUser {
  id: string;
  email: string;
  role: Role;
}

export interface CatalogTemplate {
  id: string;
  name: string;
  description?: string | null;
  type: "CONTAINER" | "COMPOSE";
  ports: { id: string; serviceName: string; name: string; port: number; exposure: string }[];
  volumes: { id: string; serviceName: string; name: string; mountPath: string; mode: string; defaultConflictPolicy: string }[];
  envVars?: { id: string; serviceName: string; key: string; value: string }[];
}

export interface UserInstance {
  id: string;
  name: string;
  status: string;
  runtimeId?: string;
  template: { id: string; name: string };
  ports: { id: string; serviceName: string; name: string; hostPort: number; remoteHost: string; remotePort: number }[];
  volumes: { id: string; serviceName: string; name: string; mountPath: string; mode: string; localPath?: string }[];
}

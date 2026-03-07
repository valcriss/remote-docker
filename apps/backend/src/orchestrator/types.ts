export interface RuntimePort {
  serviceName: string;
  name: string;
  containerPort: number;
  hostPort: number;
  remoteHost: string;
  remotePort: number;
}

export interface RuntimeVolume {
  serviceName: string;
  name: string;
  mountPath: string;
  serverPath: string;
}

export interface RuntimeInstance {
  runtimeId: string;
  status: "RUNNING" | "STOPPED";
  ports: RuntimePort[];
  volumes: RuntimeVolume[];
}

export interface StartInstanceInput {
  instanceId: string;
  templateName: string;
  templateType: "CONTAINER" | "COMPOSE";
  image?: string | null;
  composeYaml?: string | null;
  userId: string;
  ports: { serviceName: string; name: string; containerPort: number }[];
  volumes: { serviceName: string; name: string; mountPath: string }[];
  envVars: { serviceName: string; key: string; value: string }[];
}

export interface ContainerOrchestrator {
  startInstance(input: StartInstanceInput): Promise<RuntimeInstance>;
  stopInstance(runtimeId: string): Promise<void>;
  removeInstance(runtimeId: string): Promise<void>;
  restartInstance(runtimeId: string): Promise<void>;
  getInstanceStatus(runtimeId: string): Promise<"RUNNING" | "STOPPED">;
  getLogs(runtimeId: string, lines: number): Promise<string[]>;
  listServerVolumes(userId: string): Promise<{ name: string; path: string }[]>;
}

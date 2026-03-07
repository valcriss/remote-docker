import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Docker from "dockerode";
import type { ContainerCreateOptions } from "dockerode";
import YAML from "yaml";
import type { ContainerOrchestrator, RuntimeInstance, RuntimeVolume, StartInstanceInput } from "./types.js";

function resolveDocker(): Docker {
  const socketPath = process.env.DOCKER_SOCKET_PATH;
  if (socketPath) {
    return new Docker({ socketPath });
  }

  const hostUrl = process.env.DOCKER_HOST_URL;
  if (hostUrl) {
    if (hostUrl.startsWith("unix://") || hostUrl.startsWith("npipe://")) {
      return new Docker({ socketPath: hostUrl.replace(/^[a-z]+:\/\//i, "") });
    }

    const parsed = new URL(hostUrl);
    return new Docker({
      host: parsed.hostname,
      port: Number(parsed.port || (parsed.protocol === "https:" ? 2376 : 2375)),
      protocol: parsed.protocol === "https:" ? "https" : "http"
    });
  }

  if (process.platform === "win32") {
    return new Docker({ socketPath: "//./pipe/docker_engine" });
  }

  return new Docker({ socketPath: "/var/run/docker.sock" });
}

function buildRuntimeId(kind: "svc" | "ctr" | "stk" | "cmp", id: string): string {
  return `${kind}:${id}`;
}

function parseRuntimeId(runtimeId: string): { kind: "svc" | "ctr" | "stk" | "cmp"; id: string } {
  const [kind, id] = runtimeId.split(":");
  if ((kind !== "svc" && kind !== "ctr" && kind !== "stk" && kind !== "cmp") || !id) {
    throw new Error(`Invalid runtime id: ${runtimeId}`);
  }

  return { kind, id };
}

async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    stream.on("error", reject);
  });
}

function sanitizeRuntimeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
}

async function runDockerCli(args: string[]): Promise<string> {
  return await new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout).toString("utf8"));
        return;
      }

      reject(new Error(Buffer.concat(stderr).toString("utf8") || `docker command failed (${args.join(" ")})`));
    });
  });
}

function mergeEnvVars(current: unknown, additions: string[]): string[] {
  const out = new Map<string, string>();

  if (Array.isArray(current)) {
    for (const raw of current) {
      const item = String(raw);
      const eq = item.indexOf("=");
      if (eq > 0) {
        out.set(item.slice(0, eq), item.slice(eq + 1));
      }
    }
  } else if (current && typeof current === "object") {
    for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
      out.set(key, String(value ?? ""));
    }
  }

  for (const entry of additions) {
    const eq = entry.indexOf("=");
    if (eq > 0) {
      out.set(entry.slice(0, eq), entry.slice(eq + 1));
    }
  }

  return Array.from(out.entries()).map(([k, v]) => `${k}=${v}`);
}

function buildComposeYaml(input: StartInstanceInput, volumes: RuntimeVolume[]): string {
  const parsed = YAML.parse(input.composeYaml ?? "") as Record<string, unknown> | null;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid compose YAML payload.");
  }

  const services = parsed.services as Record<string, Record<string, unknown>> | undefined;
  if (!services || Object.keys(services).length === 0) {
    throw new Error("Compose YAML does not contain services.");
  }

  const portsByService = new Map<string, Array<{ serviceName: string; name: string; containerPort: number }>>();
  for (const declaration of input.ports) {
    const key = declaration.serviceName;
    if (!portsByService.has(key)) {
      portsByService.set(key, []);
    }
    portsByService.get(key)!.push(declaration);
  }

  const volumesByService = new Map<string, RuntimeVolume[]>();
  for (const declaration of volumes) {
    const key = declaration.serviceName;
    if (!volumesByService.has(key)) {
      volumesByService.set(key, []);
    }
    volumesByService.get(key)!.push(declaration);
  }

  const envByService = new Map<string, string[]>();
  for (const envVar of input.envVars) {
    const key = envVar.serviceName;
    if (!envByService.has(key)) {
      envByService.set(key, []);
    }
    envByService.get(key)!.push(`${envVar.key}=${envVar.value}`);
  }

  for (const [serviceName, declarations] of portsByService.entries()) {
    const service = services[serviceName];
    if (!service) {
      throw new Error(`Compose service '${serviceName}' not found for declared port mapping.`);
    }

    const servicePorts = Array.isArray(service.ports) ? [...service.ports] : [];
    for (const declaration of declarations) {
      const mapping = `0:${declaration.containerPort}`;
      if (!servicePorts.some((item) => String(item).includes(`:${declaration.containerPort}`) || String(item) === `${declaration.containerPort}`)) {
        servicePorts.push(mapping);
      }
    }
    service.ports = servicePorts;
    service.labels = {
      ...(service.labels as Record<string, string> | undefined),
      "rd.instanceId": input.instanceId,
      "rd.userId": input.userId,
      "rd.template": input.templateName
    };
    services[serviceName] = service;
  }

  for (const [serviceName, declarations] of volumesByService.entries()) {
    const service = services[serviceName];
    if (!service) {
      throw new Error(`Compose service '${serviceName}' not found for declared volume mapping.`);
    }

    const serviceVolumes = Array.isArray(service.volumes) ? [...service.volumes] : [];
    for (const declaration of declarations) {
      const mapping = `${declaration.serverPath}:${declaration.mountPath}`;
      if (!serviceVolumes.includes(mapping)) {
        serviceVolumes.push(mapping);
      }
    }
    service.volumes = serviceVolumes;
    service.labels = {
      ...(service.labels as Record<string, string> | undefined),
      "rd.instanceId": input.instanceId,
      "rd.userId": input.userId,
      "rd.template": input.templateName
    };
    services[serviceName] = service;
  }

  for (const [serviceName, service] of Object.entries(services)) {
    const env = envByService.get(serviceName);
    if (env && env.length > 0) {
      service.environment = mergeEnvVars(service.environment, env);
    }

    service.labels = {
      ...(service.labels as Record<string, string> | undefined),
      "rd.instanceId": input.instanceId,
      "rd.userId": input.userId,
      "rd.template": input.templateName
    };
    services[serviceName] = service;
  }

  parsed.services = services;
  return YAML.stringify(parsed);
}

export class DockerStandaloneOrchestrator implements ContainerOrchestrator {
  private readonly docker: Docker;
  private readonly mode: "swarm" | "standalone";
  private readonly remoteHost: string;

  constructor(mode: "swarm" | "standalone") {
    this.mode = mode;
    this.remoteHost = process.env.DOCKER_PUBLIC_HOST ?? os.hostname();
    this.docker = resolveDocker();
  }

  async startInstance(input: StartInstanceInput): Promise<RuntimeInstance> {
    const volumes: RuntimeVolume[] = input.volumes.map((volume) => ({
      serviceName: volume.serviceName,
      name: volume.name,
      mountPath: volume.mountPath,
      serverPath: path.posix.join("/srv/remote-docker/users", input.userId, input.instanceId, volume.name)
    }));

    if (input.templateType === "COMPOSE") {
      if (!input.composeYaml) {
        throw new Error("composeYaml is required for COMPOSE templates");
      }

      return this.mode === "swarm"
        ? await this.startComposeStack(input, volumes)
        : await this.startComposeStandalone(input, volumes);
    }

    if (!input.image) {
      throw new Error("Template image is required.");
    }

    await this.ensureImage(input.image);

    if (this.mode === "swarm") {
      return await this.startSwarmService(input, volumes);
    }

    return await this.startContainer(input, volumes);
  }

  async stopInstance(runtimeId: string): Promise<void> {
    const runtime = parseRuntimeId(runtimeId);

    if (runtime.kind === "stk") {
      const services = await this.docker.listServices({ filters: { label: [`com.docker.stack.namespace=${runtime.id}`] } });
      for (const listed of services) {
        const service = this.docker.getService(listed.ID!);
        const inspect = await service.inspect();
        const version = inspect?.Version?.Index;
        const spec = inspect?.Spec;
        if (!version || !spec) {
          continue;
        }

        if ((spec.Mode as any)?.Replicated) {
          await service.update({
            version,
            ...spec,
            Mode: { Replicated: { Replicas: 0 } }
          } as Record<string, unknown>);
        }
      }
      return;
    }

    if (runtime.kind === "cmp") {
      const containers = await this.docker.listContainers({ all: true, filters: { label: [`com.docker.compose.project=${runtime.id}`] } });
      for (const container of containers) {
        const entity = this.docker.getContainer(container.Id);
        await entity.stop({ t: 5 }).catch(() => undefined);
      }
      return;
    }

    if (runtime.kind === "svc") {
      const service = this.docker.getService(runtime.id);
      const inspect = await service.inspect();
      const version = inspect?.Version?.Index;
      const spec = inspect?.Spec;
      if (!version || !spec) {
        return;
      }

      if ((spec.Mode as any)?.Replicated) {
        await service.update({
          version,
          ...spec,
          Mode: { Replicated: { Replicas: 0 } }
        } as Record<string, unknown>);
      }
      return;
    }

    const container = this.docker.getContainer(runtime.id);
    await container.stop({ t: 5 }).catch(() => undefined);
  }

  async removeInstance(runtimeId: string): Promise<void> {
    const runtime = parseRuntimeId(runtimeId);

    if (runtime.kind === "stk") {
      await runDockerCli(["stack", "rm", runtime.id]);
      return;
    }

    if (runtime.kind === "cmp") {
      const containers = await this.docker.listContainers({ all: true, filters: { label: [`com.docker.compose.project=${runtime.id}`] } });
      for (const container of containers) {
        const entity = this.docker.getContainer(container.Id);
        await entity.stop({ t: 5 }).catch(() => undefined);
        await entity.remove({ force: true }).catch(() => undefined);
      }
      return;
    }

    if (runtime.kind === "svc") {
      await this.docker.getService(runtime.id).remove().catch(() => undefined);
      return;
    }

    const container = this.docker.getContainer(runtime.id);
    await container.stop({ t: 5 }).catch(() => undefined);
    await container.remove({ force: true }).catch(() => undefined);
  }

  async restartInstance(runtimeId: string): Promise<void> {
    const runtime = parseRuntimeId(runtimeId);

    if (runtime.kind === "stk") {
      const services = await this.docker.listServices({ filters: { label: [`com.docker.stack.namespace=${runtime.id}`] } });
      for (const listed of services) {
        const service = this.docker.getService(listed.ID!);
        const inspect = await service.inspect();
        const version = inspect?.Version?.Index;
        const spec = inspect?.Spec;
        if (!version || !spec) {
          continue;
        }

        await service.update({
          version,
          ...spec,
          Mode: (spec.Mode as any)?.Replicated ? { Replicated: { Replicas: 1 } } : spec.Mode,
          TaskTemplate: {
            ...spec.TaskTemplate,
            ForceUpdate: (spec.TaskTemplate?.ForceUpdate ?? 0) + 1
          }
        } as Record<string, unknown>);
      }
      return;
    }

    if (runtime.kind === "cmp") {
      const containers = await this.docker.listContainers({ all: true, filters: { label: [`com.docker.compose.project=${runtime.id}`] } });
      for (const container of containers) {
        await this.docker.getContainer(container.Id).restart({ t: 5 });
      }
      return;
    }

    if (runtime.kind === "svc") {
      const service = this.docker.getService(runtime.id);
      const inspect = await service.inspect();
      const version = inspect?.Version?.Index;
      const spec = inspect?.Spec;
      if (!version || !spec) {
        throw new Error("Unable to inspect swarm service for restart.");
      }

      await service.update({
        version,
        ...spec,
        Mode: (spec.Mode as any)?.Replicated ? { Replicated: { Replicas: 1 } } : spec.Mode,
        TaskTemplate: {
          ...spec.TaskTemplate,
          ForceUpdate: (spec.TaskTemplate?.ForceUpdate ?? 0) + 1
        }
      } as Record<string, unknown>);
      return;
    }

    await this.docker.getContainer(runtime.id).restart({ t: 5 });
  }

  async getInstanceStatus(runtimeId: string): Promise<"RUNNING" | "STOPPED"> {
    const runtime = parseRuntimeId(runtimeId);

    try {
      if (runtime.kind === "ctr") {
        const inspect = await this.docker.getContainer(runtime.id).inspect();
        return inspect?.State?.Running ? "RUNNING" : "STOPPED";
      }

      if (runtime.kind === "svc") {
        const tasks = await this.docker.listTasks({
          filters: {
            service: [runtime.id],
            "desired-state": ["running"]
          } as unknown as Record<string, string[]>
        });
        const hasRunning = tasks.some((task: any) => String(task?.Status?.State ?? "").toLowerCase() === "running");
        return hasRunning ? "RUNNING" : "STOPPED";
      }

      if (runtime.kind === "cmp") {
        const containers = await this.docker.listContainers({ all: true, filters: { label: [`com.docker.compose.project=${runtime.id}`] } });
        if (containers.length === 0) {
          return "STOPPED";
        }

        const hasRunning = containers.some((container) => String(container.State ?? "").toLowerCase() === "running");
        return hasRunning ? "RUNNING" : "STOPPED";
      }

      const services = await this.docker.listServices({ filters: { label: [`com.docker.stack.namespace=${runtime.id}`] } });
      if (services.length === 0) {
        return "STOPPED";
      }

      for (const service of services) {
        const tasks = await this.docker.listTasks({
          filters: {
            service: [service.ID!],
            "desired-state": ["running"]
          } as unknown as Record<string, string[]>
        });
        const hasRunning = tasks.some((task: any) => String(task?.Status?.State ?? "").toLowerCase() === "running");
        if (hasRunning) {
          return "RUNNING";
        }
      }

      return "STOPPED";
    } catch {
      return "STOPPED";
    }
  }

  async getLogs(runtimeId: string, lines: number): Promise<string[]> {
    const runtime = parseRuntimeId(runtimeId);

    if (runtime.kind === "stk") {
      const services = await this.docker.listServices({ filters: { label: [`com.docker.stack.namespace=${runtime.id}`] } });
      const allLines: string[] = [];
      for (const listed of services) {
        const service = this.docker.getService(listed.ID!);
        const stream = await service.logs({ stdout: true, stderr: true, tail: lines });
        const value = await streamToString(stream);
        allLines.push(...value.split(/\r?\n/).filter(Boolean));
      }
      return allLines.slice(-lines);
    }

    if (runtime.kind === "cmp") {
      const containers = await this.docker.listContainers({ all: true, filters: { label: [`com.docker.compose.project=${runtime.id}`] } });
      const allLines: string[] = [];
      for (const listed of containers) {
        const stream = await this.docker.getContainer(listed.Id).logs({ stdout: true, stderr: true, tail: lines });
        const value = Buffer.isBuffer(stream) ? stream.toString("utf8") : await streamToString(stream);
        allLines.push(...value.split(/\r?\n/).filter(Boolean));
      }
      return allLines.slice(-lines);
    }

    if (runtime.kind === "svc") {
      const service = this.docker.getService(runtime.id);
      const stream = await service.logs({ stdout: true, stderr: true, tail: lines });
      const value = await streamToString(stream);
      return value.split(/\r?\n/).filter(Boolean);
    }

    const container = this.docker.getContainer(runtime.id);
    const stream = await container.logs({ stdout: true, stderr: true, tail: lines });
    const value = Buffer.isBuffer(stream) ? stream.toString("utf8") : await streamToString(stream);
    return value.split(/\r?\n/).filter(Boolean);
  }

  async listServerVolumes(userId: string): Promise<{ name: string; path: string }[]> {
    const result = await this.docker.listVolumes({
      filters: {
        label: [`rd.ownerUserId=${userId}`]
      }
    });

    return (result.Volumes ?? []).map((volume) => ({ name: volume.Name, path: volume.Mountpoint }));
  }

  private async startContainer(input: StartInstanceInput, volumes: RuntimeVolume[]): Promise<RuntimeInstance> {
    const exposedPorts: Record<string, Record<string, never>> = {};
    const portBindings: Record<string, Array<{ HostPort: string; HostIp: string }>> = {};

    for (const port of input.ports) {
      const key = `${port.containerPort}/tcp`;
      exposedPorts[key] = {};
      portBindings[key] = [{ HostPort: "", HostIp: "0.0.0.0" }];
    }

    const envList = input.envVars
      .filter((env) => env.serviceName === "default")
      .map((env) => `${env.key}=${env.value}`);

    const createOptions: ContainerCreateOptions = {
      Image: input.image!,
      name: `rd-${input.userId}-${input.instanceId}`,
      Labels: {
        "rd.instanceId": input.instanceId,
        "rd.userId": input.userId,
        "rd.template": input.templateName
      },
      Env: envList,
      ExposedPorts: exposedPorts,
      HostConfig: {
        PortBindings: portBindings,
        Binds: volumes.map((v) => `${v.serverPath}:${v.mountPath}`),
        RestartPolicy: { Name: "unless-stopped" }
      }
    };

    const container = await this.docker.createContainer(createOptions);
    await container.start();
    const inspect = await container.inspect();

    const ports = input.ports.map((port) => {
      const key = `${port.containerPort}/tcp`;
      const published = inspect.NetworkSettings.Ports[key]?.[0]?.HostPort;
      return {
        serviceName: port.serviceName,
        name: port.name,
        containerPort: port.containerPort,
        hostPort: Number(published ?? 0),
        remoteHost: this.remoteHost,
        remotePort: port.containerPort
      };
    });

    return {
      runtimeId: buildRuntimeId("ctr", inspect.Id),
      status: "RUNNING",
      ports,
      volumes
    };
  }

  private async startSwarmService(input: StartInstanceInput, volumes: RuntimeVolume[]): Promise<RuntimeInstance> {
    const endpointPorts = input.ports.map((port) => ({
      Name: port.name,
      Protocol: "tcp" as const,
      TargetPort: port.containerPort,
      PublishedPort: 0,
      PublishMode: "ingress" as const
    }));

    const envList = input.envVars
      .filter((env) => env.serviceName === "default")
      .map((env) => `${env.key}=${env.value}`);

    const service = await this.docker.createService({
      Name: `rd-${input.userId}-${input.instanceId}`,
      Labels: {
        "rd.instanceId": input.instanceId,
        "rd.userId": input.userId,
        "rd.template": input.templateName
      },
      TaskTemplate: {
        ContainerSpec: {
          Image: input.image!,
          Env: envList,
          Labels: {
            "rd.instanceId": input.instanceId,
            "rd.userId": input.userId
          },
          Mounts: volumes.map((volume) => ({
            Type: "bind",
            Source: volume.serverPath,
            Target: volume.mountPath
          }))
        },
        RestartPolicy: { Condition: "any" }
      },
      EndpointSpec: { Ports: endpointPorts },
      Mode: { Replicated: { Replicas: 1 } }
    });

    const inspect = await this.docker.getService(service.id).inspect();
    const endpoint = inspect.Endpoint?.Ports ?? [];
    const ports = input.ports.map((port) => {
      const found = endpoint.find((p: { TargetPort?: number; PublishedPort?: number }) => p.TargetPort === port.containerPort);
      return {
        serviceName: port.serviceName,
        name: port.name,
        containerPort: port.containerPort,
        hostPort: Number(found?.PublishedPort ?? 0),
        remoteHost: this.remoteHost,
        remotePort: port.containerPort
      };
    });

    return {
      runtimeId: buildRuntimeId("svc", service.id),
      status: "RUNNING",
      ports,
      volumes
    };
  }

  private async startComposeStack(input: StartInstanceInput, volumes: RuntimeVolume[]): Promise<RuntimeInstance> {
    const stackName = `rd-${sanitizeRuntimeName(input.userId)}-${sanitizeRuntimeName(input.instanceId)}`;
    const composeWithOverrides = buildComposeYaml(input, volumes);
    const filePath = path.join(os.tmpdir(), `${stackName}.compose.yaml`);
    await fs.writeFile(filePath, composeWithOverrides, "utf8");

    await runDockerCli(["stack", "deploy", "-c", filePath, stackName]);

    const services = await this.docker.listServices({ filters: { label: [`com.docker.stack.namespace=${stackName}`] } });
    const discoveredPorts: Array<{ serviceName: string; target: number; published: number }> = [];
    for (const service of services) {
      const inspect = await this.docker.getService(service.ID!).inspect();
      const fullName = inspect.Spec?.Name ?? "";
      const prefix = `${stackName}_`;
      const serviceName = fullName.startsWith(prefix) ? fullName.slice(prefix.length) : fullName;
      const endpoint = inspect.Endpoint?.Ports ?? [];
      discoveredPorts.push(
        ...endpoint
          .filter((p: { TargetPort?: number; PublishedPort?: number }) => typeof p.TargetPort === "number" && typeof p.PublishedPort === "number")
          .map((p: { TargetPort?: number; PublishedPort?: number }) => ({
            serviceName,
            target: Number(p.TargetPort),
            published: Number(p.PublishedPort)
          }))
      );
    }

    return {
      runtimeId: buildRuntimeId("stk", stackName),
      status: "RUNNING",
      ports: input.ports.map((port) => {
        const found = discoveredPorts.find((p) => p.serviceName === port.serviceName && p.target === port.containerPort);
        return {
          serviceName: port.serviceName,
          name: port.name,
          containerPort: port.containerPort,
          hostPort: found?.published ?? 0,
          remoteHost: this.remoteHost,
          remotePort: port.containerPort
        };
      }),
      volumes
    };
  }

  private async startComposeStandalone(input: StartInstanceInput, volumes: RuntimeVolume[]): Promise<RuntimeInstance> {
    const project = `rd-${sanitizeRuntimeName(input.userId)}-${sanitizeRuntimeName(input.instanceId)}`;
    const composeWithOverrides = buildComposeYaml(input, volumes);
    const filePath = path.join(os.tmpdir(), `${project}.compose.yaml`);
    await fs.writeFile(filePath, composeWithOverrides, "utf8");

    await runDockerCli(["compose", "-p", project, "-f", filePath, "up", "-d"]);

    const containers = await this.docker.listContainers({ all: true, filters: { label: [`com.docker.compose.project=${project}`] } });
    const published = new Map<string, number>();
    for (const container of containers) {
      const serviceName = container.Labels?.["com.docker.compose.service"] ?? "default";
      for (const port of container.Ports ?? []) {
        if (port.PrivatePort && port.PublicPort) {
          published.set(`${serviceName}:${port.PrivatePort}`, port.PublicPort);
        }
      }
    }

    return {
      runtimeId: buildRuntimeId("cmp", project),
      status: "RUNNING",
      ports: input.ports.map((port) => ({
        serviceName: port.serviceName,
        name: port.name,
        containerPort: port.containerPort,
        hostPort: published.get(`${port.serviceName}:${port.containerPort}`) ?? 0,
        remoteHost: this.remoteHost,
        remotePort: port.containerPort
      })),
      volumes
    };
  }

  private async ensureImage(image: string): Promise<void> {
    const existing = await this.docker.listImages({ filters: { reference: [image] } });
    if (existing.length > 0) {
      return;
    }

    const stream = await this.docker.pull(image);
    await new Promise<void>((resolve, reject) => {
      this.docker.modem.followProgress(stream, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

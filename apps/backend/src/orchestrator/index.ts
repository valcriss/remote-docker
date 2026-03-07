import { DockerStandaloneOrchestrator } from "./standalone.js";
import type { ContainerOrchestrator } from "./types.js";

export function createOrchestrator(mode: string | undefined): ContainerOrchestrator {
  if (mode === "swarm") {
    return new DockerStandaloneOrchestrator("swarm");
  }

  return new DockerStandaloneOrchestrator("standalone");
}
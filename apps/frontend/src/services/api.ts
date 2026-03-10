import axios from "axios";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? "/api" });

type ApiEnvelope<T> = { data: T; meta?: Record<string, unknown>; error: null } | { data: null; error: { code: string; message: string; details?: unknown } };

function unwrap<T>(value: ApiEnvelope<T>): T {
  if (value && "error" in value && value.error) {
    throw new Error(value.error.message);
  }
  return (value as { data: T }).data;
}

export function setToken(token: string | null): void {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export async function login(email: string, password: string) {
  const { data } = await api.post<ApiEnvelope<{ token: string }>>("/auth/login", { email, password });
  return unwrap(data);
}

export async function register(email: string, password: string, role: "USER" | "ADMIN") {
  const { data } = await api.post<ApiEnvelope<{ token: string }>>("/auth/register", { email, password, role });
  return unwrap(data);
}

export async function me() {
  const { data } = await api.get<ApiEnvelope<{ id: string; email: string; role: "USER" | "ADMIN" }>>("/auth/me");
  return unwrap(data);
}

export async function meDashboard() {
  const { data } = await api.get<ApiEnvelope<any>>("/me/dashboard");
  return unwrap(data);
}

export async function adminDashboard() {
  const { data } = await api.get<ApiEnvelope<any>>("/admin/dashboard");
  return unwrap(data);
}

export async function listMeInstances() {
  const { data } = await api.get<ApiEnvelope<any[]>>("/instances");
  return unwrap(data);
}

export async function listMeForwards() {
  const { data } = await api.get<ApiEnvelope<any[]>>("/me/forwards");
  return unwrap(data);
}

export async function listTemplates() {
  const { data } = await api.get<ApiEnvelope<any[]>>("/catalog/templates");
  return unwrap(data);
}

export async function createTemplate(payload: unknown) {
  const { data } = await api.post<ApiEnvelope<any>>("/catalog/templates", payload);
  return unwrap(data);
}

export async function updateTemplate(id: string, payload: unknown) {
  const { data } = await api.put<ApiEnvelope<any>>(`/catalog/templates/${id}`, payload);
  return unwrap(data);
}

export async function deleteTemplate(id: string) {
  const { data } = await api.delete<ApiEnvelope<any>>(`/catalog/templates/${id}`);
  return unwrap(data);
}

export async function createInstance(payload: unknown) {
  const { data } = await api.post<ApiEnvelope<any>>("/instances", payload);
  return unwrap(data);
}

export async function restartInstance(id: string) {
  const { data } = await api.post<ApiEnvelope<any>>(`/instances/${id}/restart`);
  return unwrap(data);
}

export async function stopInstance(id: string) {
  const { data } = await api.post<ApiEnvelope<any>>(`/instances/${id}/stop`);
  return unwrap(data);
}

export async function deleteInstance(id: string) {
  const { data } = await api.delete<ApiEnvelope<any>>(`/instances/${id}`);
  return unwrap(data);
}

export async function listVolumes() {
  const { data } = await api.get<ApiEnvelope<any[]>>("/volumes");
  return unwrap(data);
}

export async function getLogs(instanceId: string) {
  const { data } = await api.get<ApiEnvelope<{ lines: string[] }>>(`/instances/${instanceId}/logs`);
  return unwrap(data);
}

export async function createForward(payload: { instanceId: string; serviceName?: string; portName: string; localPort: number }) {
  const { data } = await api.post<ApiEnvelope<any>>("/forwards", payload);
  return unwrap(data);
}

export async function stopForward(id: string) {
  const { data } = await api.post<ApiEnvelope<any>>(`/forwards/${id}/stop`);
  return unwrap(data);
}

export async function deleteForward(id: string) {
  const { data } = await api.delete<ApiEnvelope<any>>(`/forwards/${id}`);
  return unwrap(data);
}

export async function startSync(payload: {
  instanceVolumeId: string;
  localPath: string;
  sshHost: string;
  sshPort: number;
  sshUsername: string;
  sshPassword?: string;
  privateKeyPem?: string;
  conflictPolicy: "PREFER_LOCAL" | "PREFER_REMOTE" | "MANUAL";
}) {
  const { data } = await api.post<ApiEnvelope<{ success: boolean; syncId: string }>>("/sync/start", payload);
  return unwrap(data);
}

export async function stopSync(syncId: string) {
  const { data } = await api.post<ApiEnvelope<any>>("/sync/stop", { syncId });
  return unwrap(data);
}

export async function listAdminSessions() {
  const { data } = await api.get<ApiEnvelope<any[]>>("/admin/sessions");
  return unwrap(data);
}

export async function listAdminUsers() {
  const { data } = await api.get<ApiEnvelope<any[]>>("/admin/users");
  return unwrap(data);
}

export async function listAdminAudit() {
  const { data } = await api.get<ApiEnvelope<any[]>>("/admin/audit");
  return unwrap(data);
}

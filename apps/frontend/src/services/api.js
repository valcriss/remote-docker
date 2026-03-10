import axios from "axios";
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? "/api" });
function unwrap(value) {
    if (value && "error" in value && value.error) {
        throw new Error(value.error.message);
    }
    return value.data;
}
export function setToken(token) {
    if (token) {
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
    }
    else {
        delete api.defaults.headers.common.Authorization;
    }
}
export async function login(email, password) {
    const { data } = await api.post("/auth/login", { email, password });
    return unwrap(data);
}
export async function register(email, password, role) {
    const { data } = await api.post("/auth/register", { email, password, role });
    return unwrap(data);
}
export async function me() {
    const { data } = await api.get("/auth/me");
    return unwrap(data);
}
export async function meDashboard() {
    const { data } = await api.get("/me/dashboard");
    return unwrap(data);
}
export async function adminDashboard() {
    const { data } = await api.get("/admin/dashboard");
    return unwrap(data);
}
export async function listMeInstances() {
    const { data } = await api.get("/instances");
    return unwrap(data);
}
export async function listMeForwards() {
    const { data } = await api.get("/me/forwards");
    return unwrap(data);
}
export async function listTemplates() {
    const { data } = await api.get("/catalog/templates");
    return unwrap(data);
}
export async function createTemplate(payload) {
    const { data } = await api.post("/catalog/templates", payload);
    return unwrap(data);
}
export async function updateTemplate(id, payload) {
    const { data } = await api.put(`/catalog/templates/${id}`, payload);
    return unwrap(data);
}
export async function deleteTemplate(id) {
    const { data } = await api.delete(`/catalog/templates/${id}`);
    return unwrap(data);
}
export async function createInstance(payload) {
    const { data } = await api.post("/instances", payload);
    return unwrap(data);
}
export async function restartInstance(id) {
    const { data } = await api.post(`/instances/${id}/restart`);
    return unwrap(data);
}
export async function stopInstance(id) {
    const { data } = await api.post(`/instances/${id}/stop`);
    return unwrap(data);
}
export async function deleteInstance(id) {
    const { data } = await api.delete(`/instances/${id}`);
    return unwrap(data);
}
export async function listVolumes() {
    const { data } = await api.get("/volumes");
    return unwrap(data);
}
export async function getLogs(instanceId) {
    const { data } = await api.get(`/instances/${instanceId}/logs`);
    return unwrap(data);
}
export async function createForward(payload) {
    const { data } = await api.post("/forwards", payload);
    return unwrap(data);
}
export async function stopForward(id) {
    const { data } = await api.post(`/forwards/${id}/stop`);
    return unwrap(data);
}
export async function deleteForward(id) {
    const { data } = await api.delete(`/forwards/${id}`);
    return unwrap(data);
}
export async function startSync(payload) {
    const { data } = await api.post("/sync/start", payload);
    return unwrap(data);
}
export async function stopSync(syncId) {
    const { data } = await api.post("/sync/stop", { syncId });
    return unwrap(data);
}
export async function listAdminSessions() {
    const { data } = await api.get("/admin/sessions");
    return unwrap(data);
}
export async function listAdminUsers() {
    const { data } = await api.get("/admin/users");
    return unwrap(data);
}
export async function listAdminAudit() {
    const { data } = await api.get("/admin/audit");
    return unwrap(data);
}

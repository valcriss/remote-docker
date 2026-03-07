import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import YAML from "yaml";
import { createTemplate, deleteTemplate, listTemplates, updateTemplate } from "../services/api";
import { useAuth } from "../composables/auth";
const auth = useAuth();
const templates = ref([]);
const q = ref("");
const step = ref(1);
const error = ref("");
const composeServices = ref([]);
const expertMode = ref(false);
const wizardOpen = ref(false);
const editingTemplateId = ref(null);
const pendingDelete = ref(null);
const { t } = useI18n();
const form = ref({
    name: "",
    description: "",
    type: "CONTAINER",
    image: "",
    composeYaml: "",
    ports: [{ serviceName: "default", name: "http", port: 8080 }],
    volumes: [{ serviceName: "default", name: "workspace", mountPath: "/workspace" }],
    envVars: []
});
const steps = computed(() => [
    t("catalog.stepType"),
    t("catalog.stepSource"),
    t("catalog.stepServices"),
    t("catalog.stepMappings"),
    t("catalog.stepReview")
]);
const filtered = computed(() => templates.value.filter((t) => `${t.name} ${t.type}`.toLowerCase().includes(q.value.toLowerCase())));
const previewPayload = computed(() => ({
    name: form.value.name,
    description: form.value.description.trim() ? form.value.description : undefined,
    type: form.value.type,
    image: form.value.type === "CONTAINER" ? form.value.image || undefined : undefined,
    composeYaml: form.value.type === "COMPOSE" ? form.value.composeYaml || undefined : undefined,
    ports: form.value.ports.map((p) => ({ serviceName: p.serviceName, name: p.name, port: Number(p.port), protocol: "tcp", exposure: "FORWARDABLE" })),
    volumes: form.value.volumes.map((v) => ({ serviceName: v.serviceName, name: v.name, mountPath: v.mountPath, mode: "SYNC_BIDIRECTIONAL", defaultConflictPolicy: "PREFER_REMOTE" })),
    envVars: form.value.envVars.map((env) => ({ serviceName: env.serviceName, key: env.key, value: env.value }))
}));
const summaryServiceTargets = computed(() => {
    const names = new Set();
    for (const p of previewPayload.value.ports)
        names.add(p.serviceName);
    for (const v of previewPayload.value.volumes)
        names.add(v.serviceName);
    for (const e of previewPayload.value.envVars)
        names.add(e.serviceName);
    return Array.from(names);
});
const stepErrors = computed(() => {
    const issues = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    if (!form.value.name.trim()) {
        issues[1].push("Template name is required.");
    }
    if (form.value.type === "CONTAINER" && !form.value.image.trim()) {
        issues[2].push("Container type requires an image.");
    }
    if (form.value.type === "COMPOSE") {
        if (!form.value.composeYaml.trim()) {
            issues[2].push("Compose type requires YAML content.");
        }
        if (composeServices.value.length === 0) {
            issues[3].push("Analyze compose to detect services.");
        }
    }
    if (form.value.ports.length === 0 && form.value.volumes.length === 0) {
        issues[4].push("Declare at least one port or one volume.");
    }
    for (const p of form.value.ports) {
        if (!p.serviceName.trim() || !p.name.trim() || !Number.isFinite(Number(p.port)) || Number(p.port) <= 0) {
            issues[4].push("Each port needs Service target, Name and valid Port number.");
            break;
        }
    }
    for (const v of form.value.volumes) {
        if (!v.serviceName.trim() || !v.name.trim() || !v.mountPath.trim()) {
            issues[4].push("Each volume needs Service target, Name and Container path.");
            break;
        }
    }
    for (const env of form.value.envVars) {
        if (!env.serviceName.trim() || !env.key.trim()) {
            issues[4].push("Each environment variable needs Service target and Key.");
            break;
        }
    }
    return issues;
});
const canGoNext = computed(() => stepErrors.value[step.value].length === 0);
const canCreate = computed(() => [1, 2, 3, 4, 5].every((s) => stepErrors.value[s].length === 0));
const isAdmin = computed(() => auth.user?.role === "ADMIN");
function emptyForm() {
    form.value = {
        name: "",
        description: "",
        type: "CONTAINER",
        image: "",
        composeYaml: "",
        ports: [{ serviceName: "default", name: "http", port: 8080 }],
        volumes: [{ serviceName: "default", name: "workspace", mountPath: "/workspace" }],
        envVars: []
    };
}
function openCreateWizard() {
    editingTemplateId.value = null;
    step.value = 1;
    composeServices.value = [];
    error.value = "";
    emptyForm();
    wizardOpen.value = true;
}
function openEditWizard(template) {
    editingTemplateId.value = String(template.id);
    step.value = 1;
    error.value = "";
    composeServices.value = template.type === "COMPOSE"
        ? Array.from(new Set([
            ...(Array.isArray(template.ports) ? template.ports.map((p) => String(p.serviceName ?? "default")) : []),
            ...(Array.isArray(template.volumes) ? template.volumes.map((v) => String(v.serviceName ?? "default")) : []),
            ...(Array.isArray(template.envVars) ? template.envVars.map((e) => String(e.serviceName ?? "default")) : [])
        ]))
        : [];
    form.value = {
        name: String(template.name ?? ""),
        description: String(template.description ?? ""),
        type: template.type === "COMPOSE" ? "COMPOSE" : "CONTAINER",
        image: String(template.image ?? ""),
        composeYaml: String(template.composeYaml ?? ""),
        ports: Array.isArray(template.ports) && template.ports.length > 0
            ? template.ports.map((p) => ({ serviceName: String(p.serviceName ?? "default"), name: String(p.name ?? ""), port: Number(p.port ?? 0) }))
            : [{ serviceName: "default", name: "http", port: 8080 }],
        volumes: Array.isArray(template.volumes) && template.volumes.length > 0
            ? template.volumes.map((v) => ({ serviceName: String(v.serviceName ?? "default"), name: String(v.name ?? ""), mountPath: String(v.mountPath ?? "") }))
            : [{ serviceName: "default", name: "workspace", mountPath: "/workspace" }],
        envVars: Array.isArray(template.envVars)
            ? template.envVars.map((env) => ({ serviceName: String(env.serviceName ?? "default"), key: String(env.key ?? ""), value: String(env.value ?? "") }))
            : []
    };
    wizardOpen.value = true;
}
function closeWizard() {
    wizardOpen.value = false;
    editingTemplateId.value = null;
}
function parseContainerPort(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    if (typeof value !== "string")
        return null;
    const cleaned = value.split("/")[0];
    const segments = cleaned.split(":");
    const parsed = Number(segments[segments.length - 1]);
    return Number.isFinite(parsed) ? parsed : null;
}
function parseServiceEnv(service) {
    const output = [];
    const env = service?.environment;
    if (Array.isArray(env)) {
        for (const item of env) {
            const entry = String(item);
            const eq = entry.indexOf("=");
            if (eq <= 0)
                continue;
            output.push({ serviceName: "", key: entry.slice(0, eq), value: entry.slice(eq + 1) });
        }
        return output;
    }
    if (env && typeof env === "object") {
        for (const [key, value] of Object.entries(env)) {
            output.push({ serviceName: "", key, value: String(value ?? "") });
        }
    }
    return output;
}
function analyzeCompose() {
    error.value = "";
    try {
        const parsed = YAML.parse(form.value.composeYaml);
        const services = parsed?.services;
        if (!services || typeof services !== "object") {
            throw new Error("Compose does not define a services object.");
        }
        const serviceNames = Object.keys(services);
        composeServices.value = serviceNames;
        const generatedPorts = [];
        const generatedVolumes = [];
        const generatedEnvVars = [];
        for (const serviceName of serviceNames) {
            const service = services[serviceName] ?? {};
            const ports = Array.isArray(service.ports) ? service.ports : [];
            const volumes = Array.isArray(service.volumes) ? service.volumes : [];
            for (let i = 0; i < ports.length; i++) {
                const containerPort = parseContainerPort(ports[i]);
                if (!containerPort)
                    continue;
                generatedPorts.push({ serviceName, name: ports.length === 1 ? "http" : `port-${i + 1}`, port: containerPort });
            }
            for (let i = 0; i < volumes.length; i++) {
                const volume = volumes[i];
                let mountPath = "";
                if (typeof volume === "string") {
                    const parts = volume.split(":");
                    if (parts.length >= 2)
                        mountPath = parts[1];
                }
                else if (volume && typeof volume === "object") {
                    mountPath = String(volume.target ?? "");
                }
                if (!mountPath)
                    continue;
                generatedVolumes.push({ serviceName, name: volumes.length === 1 ? "data" : `volume-${i + 1}`, mountPath });
            }
            generatedEnvVars.push(...parseServiceEnv(service).map((env) => ({ ...env, serviceName })));
        }
        if (generatedPorts.length > 0)
            form.value.ports = generatedPorts;
        if (generatedVolumes.length > 0)
            form.value.volumes = generatedVolumes;
        if (generatedEnvVars.length > 0)
            form.value.envVars = generatedEnvVars;
        if (step.value < 4)
            step.value = 4;
    }
    catch (e) {
        error.value = e?.message ?? "Unable to parse compose YAML.";
    }
}
function addPort() {
    form.value.ports.push({ serviceName: composeServices.value[0] ?? "default", name: "http", port: 8080 });
}
function addVolume() {
    form.value.volumes.push({ serviceName: composeServices.value[0] ?? "default", name: "data", mountPath: "/data" });
}
function addEnvVar() {
    form.value.envVars.push({ serviceName: composeServices.value[0] ?? "default", key: "", value: "" });
}
function removePort(index) {
    form.value.ports.splice(index, 1);
}
function removeVolume(index) {
    form.value.volumes.splice(index, 1);
}
function removeEnvVar(index) {
    form.value.envVars.splice(index, 1);
}
async function refresh() {
    templates.value = await listTemplates();
}
function saveDraft() {
    localStorage.setItem("rd_template_wizard_draft", JSON.stringify(form.value));
}
function loadDraft() {
    const raw = localStorage.getItem("rd_template_wizard_draft");
    if (!raw)
        return;
    try {
        const parsed = JSON.parse(raw);
        form.value = {
            name: parsed.name ?? "",
            description: parsed.description ?? "",
            type: parsed.type === "COMPOSE" ? "COMPOSE" : "CONTAINER",
            image: parsed.image ?? "",
            composeYaml: parsed.composeYaml ?? "",
            ports: Array.isArray(parsed.ports) && parsed.ports.length > 0 ? parsed.ports : [{ serviceName: "default", name: "http", port: 8080 }],
            volumes: Array.isArray(parsed.volumes) && parsed.volumes.length > 0 ? parsed.volumes : [{ serviceName: "default", name: "workspace", mountPath: "/workspace" }],
            envVars: Array.isArray(parsed.envVars) ? parsed.envVars : []
        };
    }
    catch {
        // ignore corrupted draft
    }
}
function nextStep() {
    if (!canGoNext.value)
        return;
    step.value = Math.min(5, step.value + 1);
}
function prevStep() {
    step.value = Math.max(1, step.value - 1);
}
async function submitWizard() {
    error.value = "";
    if (!canCreate.value) {
        error.value = "Fix the validation errors before saving.";
        return;
    }
    if (editingTemplateId.value) {
        await updateTemplate(editingTemplateId.value, previewPayload.value);
    }
    else {
        await createTemplate(previewPayload.value);
    }
    localStorage.removeItem("rd_template_wizard_draft");
    closeWizard();
    await refresh();
}
function requestDelete(template) {
    pendingDelete.value = { id: template.id, name: template.name };
}
function cancelDelete() {
    pendingDelete.value = null;
}
async function confirmDelete() {
    if (!pendingDelete.value)
        return;
    error.value = "";
    try {
        await deleteTemplate(pendingDelete.value.id);
        pendingDelete.value = null;
        await refresh();
    }
    catch (e) {
        error.value = e?.message ?? "Delete failed.";
    }
}
onMounted(() => {
    loadDraft();
    void refresh();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "card" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "section-head" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
    ...{ class: "fa-solid fa-layer-group" },
});
(__VLS_ctx.t("catalog.title"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    placeholder: (__VLS_ctx.t('common.search')),
});
(__VLS_ctx.q);
if (__VLS_ctx.isAdmin) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.openCreateWizard) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
        ...{ class: "fa-solid fa-plus" },
    });
    (__VLS_ctx.t("catalog.addItem"));
}
if (__VLS_ctx.filtered.length > 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    (__VLS_ctx.t("catalog.name"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    (__VLS_ctx.t("catalog.description"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    (__VLS_ctx.t("catalog.type"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    (__VLS_ctx.t("catalog.ports"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    (__VLS_ctx.t("catalog.volumes"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    (__VLS_ctx.t("catalog.envVars"));
    if (__VLS_ctx.isAdmin) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
            ...{ class: "actions-cell" },
        });
        (__VLS_ctx.t("common.actions"));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
    for (const [templateItem] of __VLS_getVForSourceType((__VLS_ctx.filtered))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
            key: (templateItem.id),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        (templateItem.name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        (templateItem.description || "-");
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        (templateItem.type);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        (templateItem.ports.map((p) => `${p.serviceName}/${p.name}:${p.port}`).join(', ') || '-');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        (templateItem.volumes.map((v) => `${v.serviceName}/${v.name}@${v.mountPath}`).join(', ') || '-');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        ((templateItem.envVars ?? []).map((env) => `${env.serviceName}/${env.key}`).join(', ') || '-');
        if (__VLS_ctx.isAdmin) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                ...{ class: "actions-cell" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "row actions-row" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.filtered.length > 0))
                            return;
                        if (!(__VLS_ctx.isAdmin))
                            return;
                        __VLS_ctx.openEditWizard(templateItem);
                    } },
                ...{ class: "secondary icon-btn" },
                title: (__VLS_ctx.t('common.edit')),
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
                ...{ class: "fa-regular fa-pen-to-square" },
                'aria-hidden': "true",
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.filtered.length > 0))
                            return;
                        if (!(__VLS_ctx.isAdmin))
                            return;
                        __VLS_ctx.requestDelete({ id: templateItem.id, name: templateItem.name });
                    } },
                ...{ class: "secondary icon-btn" },
                title: (__VLS_ctx.t('common.delete')),
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
                ...{ class: "fa-regular fa-trash-can" },
                'aria-hidden': "true",
            });
        }
    }
}
else if (__VLS_ctx.templates.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.t("catalog.noItem"));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.t("catalog.noSearchResult"));
}
if (__VLS_ctx.pendingDelete) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "dialog-backdrop" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "card confirm-dialog" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
        ...{ class: "fa-solid fa-triangle-exclamation" },
    });
    (__VLS_ctx.t("catalog.deleteDialogTitle"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.t("catalog.deleteDialogBody", { name: __VLS_ctx.pendingDelete.name }));
    if (__VLS_ctx.error) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "error" },
        });
        (__VLS_ctx.error);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "row confirm-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.cancelDelete) },
        ...{ class: "secondary" },
    });
    (__VLS_ctx.t("common.cancel"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.confirmDelete) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
        ...{ class: "fa-regular fa-trash-can" },
    });
    (__VLS_ctx.t("common.delete"));
}
if (__VLS_ctx.wizardOpen) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (__VLS_ctx.closeWizard) },
        ...{ class: "dialog-backdrop" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "dialog card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "section-head dialog-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
        ...{ class: "fa-regular fa-rectangle-list" },
    });
    (__VLS_ctx.editingTemplateId ? __VLS_ctx.t("catalog.editItem") : __VLS_ctx.t("catalog.addItemTitle"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.saveDraft) },
        ...{ class: "secondary" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
        ...{ class: "fa-regular fa-floppy-disk" },
    });
    (__VLS_ctx.t("catalog.saveDraft"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.wizardOpen))
                    return;
                __VLS_ctx.expertMode = !__VLS_ctx.expertMode;
            } },
        ...{ class: "secondary" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
        ...{ class: "fa-solid fa-sliders" },
    });
    (__VLS_ctx.expertMode ? __VLS_ctx.t("catalog.hide") : __VLS_ctx.t("catalog.show"));
    (__VLS_ctx.t("catalog.advanced"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.closeWizard) },
        ...{ class: "secondary" },
    });
    (__VLS_ctx.t("catalog.close"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.ol, __VLS_intrinsicElements.ol)({
        ...{ class: "wizard-horizontal" },
    });
    for (const [label, idx] of __VLS_getVForSourceType((__VLS_ctx.steps))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
            key: (label),
            ...{ class: ({ active: __VLS_ctx.step === idx + 1, done: __VLS_ctx.step > idx + 1 }) },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (idx + 1);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (label);
    }
    if (__VLS_ctx.stepErrors[__VLS_ctx.step].length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "error" },
        });
        (__VLS_ctx.stepErrors[__VLS_ctx.step][0]);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "dialog-body" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "dialog-main" },
    });
    if (__VLS_ctx.step === 1) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
            ...{ class: "card mini" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
        (__VLS_ctx.t("catalog.stepType"));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-stack" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
            for: "template-name",
        });
        (__VLS_ctx.t("catalog.templateName"));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            id: "template-name",
            placeholder: "Ex: PostgreSQL Dev",
        });
        (__VLS_ctx.form.name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "hint" },
        });
        (__VLS_ctx.t("catalog.templateNameHint"));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
            for: "template-description",
        });
        (__VLS_ctx.t("catalog.description"));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.textarea, __VLS_intrinsicElements.textarea)({
            id: "template-description",
            value: (__VLS_ctx.form.description),
            rows: "3",
            ...{ class: "full" },
            placeholder: "Ex: Base PostgreSQL avec volume de donnees persistent",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "hint" },
        });
        (__VLS_ctx.t("catalog.templateDescriptionHint"));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
            for: "template-type",
        });
        (__VLS_ctx.t("catalog.type"));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
            id: "template-type",
            value: (__VLS_ctx.form.type),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: "CONTAINER",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: "COMPOSE",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "hint" },
        });
        (__VLS_ctx.t("catalog.templateTypeHint"));
    }
    if (__VLS_ctx.step === 2) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
            ...{ class: "card mini" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
        (__VLS_ctx.t("catalog.stepSource"));
        if (__VLS_ctx.form.type === 'CONTAINER') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "form-stack" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
                for: "template-image",
            });
            (__VLS_ctx.t("catalog.image"));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                id: "template-image",
                placeholder: "Ex: postgres:16",
            });
            (__VLS_ctx.form.image);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "hint" },
            });
            (__VLS_ctx.t("catalog.imageHint"));
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "form-stack" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
                for: "template-compose",
            });
            (__VLS_ctx.t("catalog.composeYaml"));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.textarea, __VLS_intrinsicElements.textarea)({
                id: "template-compose",
                value: (__VLS_ctx.form.composeYaml),
                rows: "10",
                ...{ class: "full" },
                placeholder: "Paste docker-compose YAML",
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "hint" },
            });
            (__VLS_ctx.t("catalog.composeHint"));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (__VLS_ctx.analyzeCompose) },
            });
            (__VLS_ctx.t("catalog.analyzeCompose"));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "hint" },
            });
            (__VLS_ctx.t("catalog.composeAnalyzeHint"));
        }
    }
    if (__VLS_ctx.step === 3) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
            ...{ class: "card mini" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
        (__VLS_ctx.t("catalog.stepServices"));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({});
        for (const [name] of __VLS_getVForSourceType((__VLS_ctx.composeServices))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
                key: (name),
            });
            (name);
        }
        if (!__VLS_ctx.composeServices.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
            (__VLS_ctx.t("catalog.serviceNotDetected"));
        }
    }
    if (__VLS_ctx.step === 4) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
            ...{ class: "card mini" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
        (__VLS_ctx.t("catalog.stepMappings"));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({});
        (__VLS_ctx.t("catalog.ports"));
        for (const [p, index] of __VLS_getVForSourceType((__VLS_ctx.form.ports))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (`p-${index}`),
                ...{ class: "row" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                placeholder: "Service target (ex: api)",
            });
            (p.serviceName);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                placeholder: "Port name (ex: http)",
            });
            (p.name);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                type: "number",
                placeholder: "Container port",
            });
            (p.port);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.wizardOpen))
                            return;
                        if (!(__VLS_ctx.step === 4))
                            return;
                        __VLS_ctx.removePort(index);
                    } },
                ...{ class: "secondary icon-btn" },
                title: (__VLS_ctx.t('catalog.deletePortTitle')),
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
                ...{ class: "fa-regular fa-trash-can" },
                'aria-hidden': "true",
            });
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.addPort) },
            ...{ class: "secondary icon-btn add-btn" },
            title: (__VLS_ctx.t('catalog.addPortTitle')),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
            ...{ class: "fa-solid fa-plus" },
            'aria-hidden': "true",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({});
        (__VLS_ctx.t("catalog.volumes"));
        for (const [v, index] of __VLS_getVForSourceType((__VLS_ctx.form.volumes))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (`v-${index}`),
                ...{ class: "row" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                placeholder: "Service target (ex: api)",
            });
            (v.serviceName);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                placeholder: "Volume name (ex: data)",
            });
            (v.name);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                placeholder: "Container path (ex: /var/lib/postgresql/data)",
            });
            (v.mountPath);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.wizardOpen))
                            return;
                        if (!(__VLS_ctx.step === 4))
                            return;
                        __VLS_ctx.removeVolume(index);
                    } },
                ...{ class: "secondary icon-btn" },
                title: (__VLS_ctx.t('catalog.deleteVolumeTitle')),
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
                ...{ class: "fa-regular fa-trash-can" },
                'aria-hidden': "true",
            });
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.addVolume) },
            ...{ class: "secondary icon-btn add-btn" },
            title: (__VLS_ctx.t('catalog.addVolumeTitle')),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
            ...{ class: "fa-solid fa-plus" },
            'aria-hidden': "true",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({});
        (__VLS_ctx.t("catalog.envVars"));
        for (const [env, index] of __VLS_getVForSourceType((__VLS_ctx.form.envVars))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (`e-${index}`),
                ...{ class: "row" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                placeholder: "Service target (ex: db)",
            });
            (env.serviceName);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                placeholder: "Key (ex: POSTGRES_PASSWORD)",
            });
            (env.key);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                placeholder: "Value",
            });
            (env.value);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.wizardOpen))
                            return;
                        if (!(__VLS_ctx.step === 4))
                            return;
                        __VLS_ctx.removeEnvVar(index);
                    } },
                ...{ class: "secondary icon-btn" },
                title: (__VLS_ctx.t('catalog.deleteEnvTitle')),
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
                ...{ class: "fa-regular fa-trash-can" },
                'aria-hidden': "true",
            });
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.addEnvVar) },
            ...{ class: "secondary icon-btn add-btn" },
            title: (__VLS_ctx.t('catalog.addEnvTitle')),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
            ...{ class: "fa-solid fa-plus" },
            'aria-hidden': "true",
        });
    }
    if (__VLS_ctx.step === 5) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
            ...{ class: "card mini" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
        (__VLS_ctx.t("catalog.stepReview"));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({
            ...{ class: "logs-box" },
        });
        (JSON.stringify(__VLS_ctx.previewPayload, null, 2));
    }
    if (__VLS_ctx.expertMode) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
            ...{ class: "card mini" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.textarea, __VLS_intrinsicElements.textarea)({
            value: (__VLS_ctx.form.composeYaml),
            rows: "8",
            ...{ class: "full" },
            placeholder: "Raw compose YAML",
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.aside, __VLS_intrinsicElements.aside)({
        ...{ class: "dialog-summary card mini" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
    (__VLS_ctx.t("catalog.summary"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.t("catalog.name"));
    (__VLS_ctx.previewPayload.name || "-");
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.t("catalog.description"));
    (__VLS_ctx.previewPayload.description || "-");
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.t("catalog.type"));
    (__VLS_ctx.previewPayload.type);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.t("catalog.ports"));
    (__VLS_ctx.previewPayload.ports.length);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.t("catalog.volumes"));
    (__VLS_ctx.previewPayload.volumes.length);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.t("catalog.envVars"));
    (__VLS_ctx.previewPayload.envVars.length);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({});
    (__VLS_ctx.t("catalog.serviceTargets"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({});
    for (const [name] of __VLS_getVForSourceType((__VLS_ctx.summaryServiceTargets))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
            key: (name),
        });
        (name);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({});
    (__VLS_ctx.t("catalog.envPreview"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({});
    for (const [env, idx] of __VLS_getVForSourceType((__VLS_ctx.previewPayload.envVars.slice(0, 8)))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
            key: (`summary-env-${idx}`),
        });
        (env.key);
        (env.value);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "row dialog-footer" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.prevStep) },
        ...{ class: "secondary" },
        disabled: (__VLS_ctx.step === 1),
    });
    (__VLS_ctx.t("common.back"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.closeWizard) },
        ...{ class: "secondary" },
    });
    (__VLS_ctx.t("common.cancel"));
    if (__VLS_ctx.step < 5) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.nextStep) },
            disabled: (!__VLS_ctx.canGoNext),
        });
        (__VLS_ctx.t("common.next"));
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.submitWizard) },
            disabled: (!__VLS_ctx.canCreate),
        });
        (__VLS_ctx.editingTemplateId ? __VLS_ctx.t("catalog.saveChanges") : __VLS_ctx.t("catalog.createTemplate"));
    }
    if (__VLS_ctx.error) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "error" },
        });
        (__VLS_ctx.error);
    }
}
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-solid']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-layer-group']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-solid']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-plus']} */ ;
/** @type {__VLS_StyleScopedClasses['actions-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['actions-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['actions-row']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-regular']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-pen-to-square']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-regular']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-trash-can']} */ ;
/** @type {__VLS_StyleScopedClasses['dialog-backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['confirm-dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-solid']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-triangle-exclamation']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['confirm-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-regular']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-trash-can']} */ ;
/** @type {__VLS_StyleScopedClasses['dialog-backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['dialog-head']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-regular']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-rectangle-list']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-regular']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-floppy-disk']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-solid']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-sliders']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['wizard-horizontal']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
/** @type {__VLS_StyleScopedClasses['dialog-body']} */ ;
/** @type {__VLS_StyleScopedClasses['dialog-main']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['mini']} */ ;
/** @type {__VLS_StyleScopedClasses['form-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['hint']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['hint']} */ ;
/** @type {__VLS_StyleScopedClasses['hint']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['mini']} */ ;
/** @type {__VLS_StyleScopedClasses['form-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['hint']} */ ;
/** @type {__VLS_StyleScopedClasses['form-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['hint']} */ ;
/** @type {__VLS_StyleScopedClasses['hint']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['mini']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['mini']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-regular']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-trash-can']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['add-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-solid']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-plus']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-regular']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-trash-can']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['add-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-solid']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-plus']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-regular']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-trash-can']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['add-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-solid']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-plus']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['mini']} */ ;
/** @type {__VLS_StyleScopedClasses['logs-box']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['mini']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['dialog-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['mini']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['dialog-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            templates: templates,
            q: q,
            step: step,
            error: error,
            composeServices: composeServices,
            expertMode: expertMode,
            wizardOpen: wizardOpen,
            editingTemplateId: editingTemplateId,
            pendingDelete: pendingDelete,
            t: t,
            form: form,
            steps: steps,
            filtered: filtered,
            previewPayload: previewPayload,
            summaryServiceTargets: summaryServiceTargets,
            stepErrors: stepErrors,
            canGoNext: canGoNext,
            canCreate: canCreate,
            isAdmin: isAdmin,
            openCreateWizard: openCreateWizard,
            openEditWizard: openEditWizard,
            closeWizard: closeWizard,
            analyzeCompose: analyzeCompose,
            addPort: addPort,
            addVolume: addVolume,
            addEnvVar: addEnvVar,
            removePort: removePort,
            removeVolume: removeVolume,
            removeEnvVar: removeEnvVar,
            saveDraft: saveDraft,
            nextStep: nextStep,
            prevStep: prevStep,
            submitWizard: submitWizard,
            requestDelete: requestDelete,
            cancelDelete: cancelDelete,
            confirmDelete: confirmDelete,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */

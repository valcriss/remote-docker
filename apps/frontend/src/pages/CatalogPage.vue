<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import YAML from "yaml";
import { createTemplate, deleteTemplate, listTemplates, updateTemplate } from "../services/api";
import { useAuth } from "../composables/auth";

interface PortDecl {
  serviceName: string;
  name: string;
  port: number;
}

interface VolumeDecl {
  serviceName: string;
  name: string;
  mountPath: string;
}

interface EnvDecl {
  serviceName: string;
  key: string;
  value: string;
}

const auth = useAuth();
const templates = ref<any[]>([]);
const q = ref("");
const step = ref(1);
const error = ref("");
const composeServices = ref<string[]>([]);
const expertMode = ref(false);
const wizardOpen = ref(false);
const editingTemplateId = ref<string | null>(null);
const pendingDelete = ref<{ id: string; name: string } | null>(null);
const { t } = useI18n();

const form = ref({
  name: "",
  description: "",
  type: "CONTAINER" as "CONTAINER" | "COMPOSE",
  image: "",
  composeYaml: "",
  ports: [{ serviceName: "default", name: "http", port: 8080 }] as PortDecl[],
  volumes: [{ serviceName: "default", name: "workspace", mountPath: "/workspace" }] as VolumeDecl[],
  envVars: [] as EnvDecl[]
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
  const names = new Set<string>();
  for (const p of previewPayload.value.ports) names.add(p.serviceName);
  for (const v of previewPayload.value.volumes) names.add(v.serviceName);
  for (const e of previewPayload.value.envVars) names.add(e.serviceName);
  return Array.from(names);
});

const stepErrors = computed(() => {
  const issues: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };

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

function emptyForm(): void {
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

function openCreateWizard(): void {
  editingTemplateId.value = null;
  step.value = 1;
  composeServices.value = [];
  error.value = "";
  emptyForm();
  wizardOpen.value = true;
}

function openEditWizard(template: any): void {
  editingTemplateId.value = String(template.id);
  step.value = 1;
  error.value = "";
  composeServices.value = template.type === "COMPOSE"
    ? Array.from(new Set([
      ...(Array.isArray(template.ports) ? template.ports.map((p: any) => String(p.serviceName ?? "default")) : []),
      ...(Array.isArray(template.volumes) ? template.volumes.map((v: any) => String(v.serviceName ?? "default")) : []),
      ...(Array.isArray(template.envVars) ? template.envVars.map((e: any) => String(e.serviceName ?? "default")) : [])
    ]))
    : [];

  form.value = {
    name: String(template.name ?? ""),
    description: String(template.description ?? ""),
    type: template.type === "COMPOSE" ? "COMPOSE" : "CONTAINER",
    image: String(template.image ?? ""),
    composeYaml: String(template.composeYaml ?? ""),
    ports: Array.isArray(template.ports) && template.ports.length > 0
      ? template.ports.map((p: any) => ({ serviceName: String(p.serviceName ?? "default"), name: String(p.name ?? ""), port: Number(p.port ?? 0) }))
      : [{ serviceName: "default", name: "http", port: 8080 }],
    volumes: Array.isArray(template.volumes) && template.volumes.length > 0
      ? template.volumes.map((v: any) => ({ serviceName: String(v.serviceName ?? "default"), name: String(v.name ?? ""), mountPath: String(v.mountPath ?? "") }))
      : [{ serviceName: "default", name: "workspace", mountPath: "/workspace" }],
    envVars: Array.isArray(template.envVars)
      ? template.envVars.map((env: any) => ({ serviceName: String(env.serviceName ?? "default"), key: String(env.key ?? ""), value: String(env.value ?? "") }))
      : []
  };

  wizardOpen.value = true;
}

function closeWizard(): void {
  wizardOpen.value = false;
  editingTemplateId.value = null;
}

function parseContainerPort(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.split("/")[0];
  const segments = cleaned.split(":");
  const parsed = Number(segments[segments.length - 1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseServiceEnv(service: any): EnvDecl[] {
  const output: EnvDecl[] = [];
  const env = service?.environment;

  if (Array.isArray(env)) {
    for (const item of env) {
      const entry = String(item);
      const eq = entry.indexOf("=");
      if (eq <= 0) continue;
      output.push({ serviceName: "", key: entry.slice(0, eq), value: entry.slice(eq + 1) });
    }
    return output;
  }

  if (env && typeof env === "object") {
    for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
      output.push({ serviceName: "", key, value: String(value ?? "") });
    }
  }

  return output;
}

function analyzeCompose(): void {
  error.value = "";
  try {
    const parsed = YAML.parse(form.value.composeYaml) as any;
    const services = parsed?.services;
    if (!services || typeof services !== "object") {
      throw new Error("Compose does not define a services object.");
    }

    const serviceNames = Object.keys(services);
    composeServices.value = serviceNames;

    const generatedPorts: PortDecl[] = [];
    const generatedVolumes: VolumeDecl[] = [];
    const generatedEnvVars: EnvDecl[] = [];

    for (const serviceName of serviceNames) {
      const service = services[serviceName] ?? {};
      const ports = Array.isArray(service.ports) ? service.ports : [];
      const volumes = Array.isArray(service.volumes) ? service.volumes : [];

      for (let i = 0; i < ports.length; i++) {
        const containerPort = parseContainerPort(ports[i]);
        if (!containerPort) continue;
        generatedPorts.push({ serviceName, name: ports.length === 1 ? "http" : `port-${i + 1}`, port: containerPort });
      }

      for (let i = 0; i < volumes.length; i++) {
        const volume = volumes[i];
        let mountPath = "";
        if (typeof volume === "string") {
          const parts = volume.split(":");
          if (parts.length >= 2) mountPath = parts[1];
        } else if (volume && typeof volume === "object") {
          mountPath = String(volume.target ?? "");
        }

        if (!mountPath) continue;
        generatedVolumes.push({ serviceName, name: volumes.length === 1 ? "data" : `volume-${i + 1}`, mountPath });
      }

      generatedEnvVars.push(...parseServiceEnv(service).map((env) => ({ ...env, serviceName })));
    }

    if (generatedPorts.length > 0) form.value.ports = generatedPorts;
    if (generatedVolumes.length > 0) form.value.volumes = generatedVolumes;
    if (generatedEnvVars.length > 0) form.value.envVars = generatedEnvVars;
    if (step.value < 4) step.value = 4;
  } catch (e: any) {
    error.value = e?.message ?? "Unable to parse compose YAML.";
  }
}

function addPort(): void {
  form.value.ports.push({ serviceName: composeServices.value[0] ?? "default", name: "http", port: 8080 });
}

function addVolume(): void {
  form.value.volumes.push({ serviceName: composeServices.value[0] ?? "default", name: "data", mountPath: "/data" });
}

function addEnvVar(): void {
  form.value.envVars.push({ serviceName: composeServices.value[0] ?? "default", key: "", value: "" });
}

function removePort(index: number): void {
  form.value.ports.splice(index, 1);
}

function removeVolume(index: number): void {
  form.value.volumes.splice(index, 1);
}

function removeEnvVar(index: number): void {
  form.value.envVars.splice(index, 1);
}

async function refresh(): Promise<void> {
  templates.value = await listTemplates();
}

function saveDraft(): void {
  localStorage.setItem("rd_template_wizard_draft", JSON.stringify(form.value));
}

function loadDraft(): void {
  const raw = localStorage.getItem("rd_template_wizard_draft");
  if (!raw) return;
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
  } catch {
    // ignore corrupted draft
  }
}

function nextStep(): void {
  if (!canGoNext.value) return;
  step.value = Math.min(5, step.value + 1);
}

function prevStep(): void {
  step.value = Math.max(1, step.value - 1);
}

async function submitWizard(): Promise<void> {
  error.value = "";
  if (!canCreate.value) {
    error.value = "Fix the validation errors before saving.";
    return;
  }

  if (editingTemplateId.value) {
    await updateTemplate(editingTemplateId.value, previewPayload.value);
  } else {
    await createTemplate(previewPayload.value);
  }

  localStorage.removeItem("rd_template_wizard_draft");
  closeWizard();
  await refresh();
}

function requestDelete(template: { id: string; name: string }): void {
  pendingDelete.value = { id: template.id, name: template.name };
}

function cancelDelete(): void {
  pendingDelete.value = null;
}

async function confirmDelete(): Promise<void> {
  if (!pendingDelete.value) return;
  error.value = "";
  try {
    await deleteTemplate(pendingDelete.value.id);
    pendingDelete.value = null;
    await refresh();
  } catch (e: any) {
    error.value = e?.message ?? "Delete failed.";
  }
}

onMounted(() => {
  loadDraft();
  void refresh();
});
</script>

<template>
  <section class="card">
    <div class="section-head">
      <h2><i class="fa-solid fa-layer-group"></i> {{ t("catalog.title") }}</h2>
      <div class="row">
        <input v-model="q" :placeholder="t('common.search')" />
        <button v-if="isAdmin" @click="openCreateWizard"><i class="fa-solid fa-plus"></i> {{ t("catalog.addItem") }}</button>
      </div>
    </div>

    <table v-if="filtered.length > 0">
      <thead>
        <tr>
          <th>{{ t("catalog.name") }}</th>
          <th>{{ t("catalog.description") }}</th>
          <th>{{ t("catalog.type") }}</th>
          <th>{{ t("catalog.ports") }}</th>
          <th>{{ t("catalog.volumes") }}</th>
          <th>{{ t("catalog.envVars") }}</th>
          <th v-if="isAdmin" class="actions-cell">{{ t("common.actions") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="templateItem in filtered" :key="templateItem.id">
          <td>{{ templateItem.name }}</td>
          <td>{{ templateItem.description || "-" }}</td>
          <td>{{ templateItem.type }}</td>
          <td>{{ templateItem.ports.map((p: any) => `${p.serviceName}/${p.name}:${p.port}`).join(', ') || '-' }}</td>
          <td>{{ templateItem.volumes.map((v: any) => `${v.serviceName}/${v.name}@${v.mountPath}`).join(', ') || '-' }}</td>
          <td>{{ (templateItem.envVars ?? []).map((env: any) => `${env.serviceName}/${env.key}`).join(', ') || '-' }}</td>
          <td v-if="isAdmin" class="actions-cell">
            <div class="row actions-row">
              <button class="secondary icon-btn" :title="t('common.edit')" @click="openEditWizard(templateItem)">
                <i class="fa-regular fa-pen-to-square" aria-hidden="true"></i>
              </button>
              <button class="secondary icon-btn" :title="t('common.delete')" @click="requestDelete({ id: templateItem.id, name: templateItem.name })">
                <i class="fa-regular fa-trash-can" aria-hidden="true"></i>
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-else-if="templates.length === 0">{{ t("catalog.noItem") }}</p>
    <p v-else>{{ t("catalog.noSearchResult") }}</p>
  </section>

  <div v-if="pendingDelete" class="dialog-backdrop">
    <section class="card confirm-dialog">
      <h3><i class="fa-solid fa-triangle-exclamation"></i> {{ t("catalog.deleteDialogTitle") }}</h3>
      <p>{{ t("catalog.deleteDialogBody", { name: pendingDelete.name }) }}</p>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="row confirm-actions">
        <button class="secondary" @click="cancelDelete">{{ t("common.cancel") }}</button>
        <button @click="confirmDelete"><i class="fa-regular fa-trash-can"></i> {{ t("common.delete") }}</button>
      </div>
    </section>
  </div>

  <div v-if="wizardOpen" class="dialog-backdrop" @click.self="closeWizard">
    <section class="dialog card">
      <div class="section-head dialog-head">
        <h2><i class="fa-regular fa-rectangle-list"></i> {{ editingTemplateId ? t("catalog.editItem") : t("catalog.addItemTitle") }}</h2>
        <div class="row">
          <button class="secondary" @click="saveDraft"><i class="fa-regular fa-floppy-disk"></i> {{ t("catalog.saveDraft") }}</button>
          <button class="secondary" @click="expertMode = !expertMode"><i class="fa-solid fa-sliders"></i> {{ expertMode ? t("catalog.hide") : t("catalog.show") }} {{ t("catalog.advanced") }}</button>
          <button class="secondary" @click="closeWizard">{{ t("catalog.close") }}</button>
        </div>
      </div>

      <ol class="wizard-horizontal">
        <li v-for="(label, idx) in steps" :key="label" :class="{ active: step === idx + 1, done: step > idx + 1 }">
          <span>{{ idx + 1 }}</span>
          <strong>{{ label }}</strong>
        </li>
      </ol>

      <p v-if="stepErrors[step].length" class="error">{{ stepErrors[step][0] }}</p>

      <div class="dialog-body">
        <div class="dialog-main">
          <section v-if="step === 1" class="card mini">
            <h3>{{ t("catalog.stepType") }}</h3>
            <div class="form-stack">
              <label for="template-name">{{ t("catalog.templateName") }}</label>
              <input id="template-name" v-model="form.name" placeholder="Ex: PostgreSQL Dev" />
              <p class="hint">{{ t("catalog.templateNameHint") }}</p>

              <label for="template-description">{{ t("catalog.description") }}</label>
              <textarea id="template-description" v-model="form.description" rows="3" class="full" placeholder="Ex: Base PostgreSQL avec volume de donnees persistent"></textarea>
              <p class="hint">{{ t("catalog.templateDescriptionHint") }}</p>

              <label for="template-type">{{ t("catalog.type") }}</label>
              <select id="template-type" v-model="form.type">
                <option value="CONTAINER">Container</option>
                <option value="COMPOSE">Docker Compose</option>
              </select>
              <p class="hint">{{ t("catalog.templateTypeHint") }}</p>
            </div>
          </section>

          <section v-if="step === 2" class="card mini">
            <h3>{{ t("catalog.stepSource") }}</h3>
            <div class="form-stack" v-if="form.type === 'CONTAINER'">
              <label for="template-image">{{ t("catalog.image") }}</label>
              <input id="template-image" v-model="form.image" placeholder="Ex: postgres:16" />
              <p class="hint">{{ t("catalog.imageHint") }}</p>
            </div>
            <div class="form-stack" v-else>
              <label for="template-compose">{{ t("catalog.composeYaml") }}</label>
              <textarea id="template-compose" v-model="form.composeYaml" rows="10" class="full" placeholder="Paste docker-compose YAML"></textarea>
              <p class="hint">{{ t("catalog.composeHint") }}</p>
              <div>
                <button @click="analyzeCompose">{{ t("catalog.analyzeCompose") }}</button>
              </div>
              <p class="hint">{{ t("catalog.composeAnalyzeHint") }}</p>
            </div>
          </section>

          <section v-if="step === 3" class="card mini">
            <h3>{{ t("catalog.stepServices") }}</h3>
            <ul>
              <li v-for="name in composeServices" :key="name">{{ name }}</li>
            </ul>
            <p v-if="!composeServices.length">{{ t("catalog.serviceNotDetected") }}</p>
          </section>

          <section v-if="step === 4" class="card mini">
            <h3>{{ t("catalog.stepMappings") }}</h3>
            <h4>{{ t("catalog.ports") }}</h4>
            <div v-for="(p, index) in form.ports" :key="`p-${index}`" class="row">
              <input v-model="p.serviceName" placeholder="Service target (ex: api)" />
              <input v-model="p.name" placeholder="Port name (ex: http)" />
              <input v-model.number="p.port" type="number" placeholder="Container port" />
              <button class="secondary icon-btn" :title="t('catalog.deletePortTitle')" @click="removePort(index)">
                <i class="fa-regular fa-trash-can" aria-hidden="true"></i>
              </button>
            </div>
            <button class="secondary icon-btn add-btn" :title="t('catalog.addPortTitle')" @click="addPort">
              <i class="fa-solid fa-plus" aria-hidden="true"></i>
            </button>

            <h4>{{ t("catalog.volumes") }}</h4>
            <div v-for="(v, index) in form.volumes" :key="`v-${index}`" class="row">
              <input v-model="v.serviceName" placeholder="Service target (ex: api)" />
              <input v-model="v.name" placeholder="Volume name (ex: data)" />
              <input v-model="v.mountPath" placeholder="Container path (ex: /var/lib/postgresql/data)" />
              <button class="secondary icon-btn" :title="t('catalog.deleteVolumeTitle')" @click="removeVolume(index)">
                <i class="fa-regular fa-trash-can" aria-hidden="true"></i>
              </button>
            </div>
            <button class="secondary icon-btn add-btn" :title="t('catalog.addVolumeTitle')" @click="addVolume">
              <i class="fa-solid fa-plus" aria-hidden="true"></i>
            </button>

            <h4>{{ t("catalog.envVars") }}</h4>
            <div v-for="(env, index) in form.envVars" :key="`e-${index}`" class="row">
              <input v-model="env.serviceName" placeholder="Service target (ex: db)" />
              <input v-model="env.key" placeholder="Key (ex: POSTGRES_PASSWORD)" />
              <input v-model="env.value" placeholder="Value" />
              <button class="secondary icon-btn" :title="t('catalog.deleteEnvTitle')" @click="removeEnvVar(index)">
                <i class="fa-regular fa-trash-can" aria-hidden="true"></i>
              </button>
            </div>
            <button class="secondary icon-btn add-btn" :title="t('catalog.addEnvTitle')" @click="addEnvVar">
              <i class="fa-solid fa-plus" aria-hidden="true"></i>
            </button>
          </section>

          <section v-if="step === 5" class="card mini">
            <h3>{{ t("catalog.stepReview") }}</h3>
            <pre class="logs-box">{{ JSON.stringify(previewPayload, null, 2) }}</pre>
          </section>

          <section v-if="expertMode" class="card mini">
            <h3>Advanced (Expert Mode)</h3>
            <textarea v-model="form.composeYaml" rows="8" class="full" placeholder="Raw compose YAML"></textarea>
          </section>
        </div>

        <aside class="dialog-summary card mini">
          <h3>{{ t("catalog.summary") }}</h3>
          <p><strong>{{ t("catalog.name") }}:</strong> {{ previewPayload.name || "-" }}</p>
          <p><strong>{{ t("catalog.description") }}:</strong> {{ previewPayload.description || "-" }}</p>
          <p><strong>{{ t("catalog.type") }}:</strong> {{ previewPayload.type }}</p>
          <p><strong>{{ t("catalog.ports") }}:</strong> {{ previewPayload.ports.length }}</p>
          <p><strong>{{ t("catalog.volumes") }}:</strong> {{ previewPayload.volumes.length }}</p>
          <p><strong>{{ t("catalog.envVars") }}:</strong> {{ previewPayload.envVars.length }}</p>

          <h4>{{ t("catalog.serviceTargets") }}</h4>
          <ul>
            <li v-for="name in summaryServiceTargets" :key="name">{{ name }}</li>
          </ul>

          <h4>{{ t("catalog.envPreview") }}</h4>
          <ul>
            <li v-for="(env, idx) in previewPayload.envVars.slice(0, 8)" :key="`summary-env-${idx}`">{{ env.key }}={{ env.value }}</li>
          </ul>
        </aside>
      </div>

      <div class="row dialog-footer">
        <button class="secondary" :disabled="step === 1" @click="prevStep">{{ t("common.back") }}</button>
        <button class="secondary" @click="closeWizard">{{ t("common.cancel") }}</button>
        <button v-if="step < 5" :disabled="!canGoNext" @click="nextStep">{{ t("common.next") }}</button>
        <button v-else :disabled="!canCreate" @click="submitWizard">{{ editingTemplateId ? t("catalog.saveChanges") : t("catalog.createTemplate") }}</button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </section>
  </div>
</template>

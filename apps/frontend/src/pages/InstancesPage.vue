<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import StatusBadge from "../components/StatusBadge.vue";
import SideDrawer from "../components/SideDrawer.vue";
import { createInstance, deleteInstance, listMeInstances, listTemplates, restartInstance, stopInstance } from "../services/api";

const instances = ref<any[]>([]);
const templates = ref<any[]>([]);
const selected = ref<any | null>(null);
const q = ref("");
const status = ref("ALL");
const page = ref(1);
const pageSize = 8;

const wizardOpen = ref(false);
const wizardStep = ref(1);
const wizard = ref({ templateId: "", name: "" });
const error = ref("");
const pendingDelete = ref<{ id: string; name: string } | null>(null);
const { t } = useI18n();

const filtered = computed(() => instances.value
  .filter((i) => status.value === "ALL" || i.status === status.value)
  .filter((i) => `${i.name} ${i.template?.name}`.toLowerCase().includes(q.value.toLowerCase())));

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)));
const pageItems = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize));

async function refresh(): Promise<void> {
  instances.value = await listMeInstances();
  templates.value = await listTemplates();
}

async function restart(id: string): Promise<void> {
  await restartInstance(id);
  await refresh();
}

async function stop(id: string): Promise<void> {
  await stopInstance(id);
  await refresh();
}

async function createFromWizard(): Promise<void> {
  await createInstance({ templateId: wizard.value.templateId, name: wizard.value.name, volumeOverrides: [] });
  wizardOpen.value = false;
  wizardStep.value = 1;
  wizard.value = { templateId: "", name: "" };
  await refresh();
}

async function removeInstance(item: { id: string; name: string; status: string }): Promise<void> {
  error.value = "";
  if (item.status !== "STOPPED") {
    error.value = t("instances.deleteNotAllowed");
    return;
  }
  pendingDelete.value = { id: item.id, name: item.name };
}

function cancelDelete(): void {
  pendingDelete.value = null;
}

async function confirmDelete(): Promise<void> {
  if (!pendingDelete.value) return;
  try {
    await deleteInstance(pendingDelete.value.id);
    if (selected.value?.id === pendingDelete.value.id) {
      selected.value = null;
    }
    pendingDelete.value = null;
    await refresh();
  } catch (e: any) {
    error.value = e?.message ?? "Delete failed.";
  }
}

onMounted(() => { void refresh(); });
</script>

<template>
  <section class="card">
    <div class="section-head">
      <h2><i class="fa-solid fa-server"></i> {{ t("instances.title") }}</h2>
      <button @click="wizardOpen = true"><i class="fa-solid fa-plus"></i> {{ t("instances.create") }}</button>
    </div>
    <div class="row">
      <input v-model="q" :placeholder="t('instances.search')" />
      <select v-model="status"><option>ALL</option><option>RUNNING</option><option>STOPPED</option><option>DEPLOYING</option><option>FAILED</option></select>
    </div>

    <table>
      <thead><tr><th>{{ t("instances.name") }}</th><th>{{ t("instances.status") }}</th><th>{{ t("instances.template") }}</th><th>{{ t("instances.ports") }}</th><th>{{ t("common.actions") }}</th></tr></thead>
      <tbody>
        <tr v-for="item in pageItems" :key="item.id" @click="selected = item" class="row-clickable">
          <td>{{ item.name }}</td>
          <td><StatusBadge :status="item.status" /></td>
          <td>{{ item.template?.name }}</td>
          <td>{{ item.ports.length }}</td>
          <td>
            <div class="row">
              <button @click.stop="restart(item.id)"><i class="fa-solid fa-rotate-right"></i> {{ t("common.restart") }}</button>
              <button class="secondary" @click.stop="stop(item.id)"><i class="fa-solid fa-stop"></i> {{ t("common.stop") }}</button>
              <button
                v-if="item.status === 'STOPPED'"
                class="secondary"
                @click.stop="removeInstance(item)"
                :title="t('common.delete')"
              >
                <i class="fa-regular fa-trash-can"></i> {{ t("common.delete") }}
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="row pager">
      <button class="secondary" :disabled="page <= 1" @click="page--">{{ t("common.back") }}</button>
      <span>{{ t("instances.page", { page, total: totalPages }) }}</span>
      <button class="secondary" :disabled="page >= totalPages" @click="page++">{{ t("common.next") }}</button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
  </section>

  <SideDrawer :open="!!selected" :title="t('instances.details')" @close="selected = null">
    <template v-if="selected">
      <p><strong>{{ selected.name }}</strong></p>
      <p>{{ t("instances.status") }}: <StatusBadge :status="selected.status" /></p>
      <h4>{{ t("instances.ports") }}</h4>
      <ul>
        <li v-for="p in selected.ports" :key="p.id">{{ p.serviceName }}/{{ p.name }} -> localhost:{{ p.hostPort }}</li>
      </ul>
      <h4>{{ t("instances.volumes") }}</h4>
      <ul>
        <li v-for="v in selected.volumes" :key="v.id">{{ v.serviceName }}/{{ v.name }} @ {{ v.mountPath }}</li>
      </ul>
    </template>
  </SideDrawer>

  <SideDrawer :open="wizardOpen" :title="t('instances.wizardTitle')" @close="wizardOpen = false">
    <div v-if="wizardStep === 1">
      <h4>{{ t("instances.step1") }}</h4>
      <select v-model="wizard.templateId"><option value="">{{ t("instances.selectTemplate") }}</option><option v-for="t in templates" :key="t.id" :value="t.id">{{ t.name }}</option></select>
      <div class="row"><button :disabled="!wizard.templateId" @click="wizardStep = 2">{{ t("common.next") }}</button></div>
    </div>
    <div v-else-if="wizardStep === 2">
      <h4>{{ t("instances.step2") }}</h4>
      <input v-model="wizard.name" :placeholder="t('instances.instanceName')" />
      <div class="row"><button class="secondary" @click="wizardStep = 1">{{ t("common.back") }}</button><button :disabled="!wizard.name" @click="wizardStep = 3">{{ t("common.next") }}</button></div>
    </div>
    <div v-else>
      <h4>{{ t("instances.step3") }}</h4>
      <p>{{ t("instances.template") }}: {{ templates.find(t=>t.id===wizard.templateId)?.name }}</p>
      <p>{{ t("instances.name") }}: {{ wizard.name }}</p>
      <div class="row"><button class="secondary" @click="wizardStep = 2">{{ t("common.back") }}</button><button @click="createFromWizard">{{ t("common.create") }}</button></div>
    </div>
  </SideDrawer>

  <div v-if="pendingDelete" class="dialog-backdrop">
    <section class="card confirm-dialog">
      <h3><i class="fa-solid fa-triangle-exclamation"></i> {{ t("catalog.deleteDialogTitle") }}</h3>
      <p>{{ t("instances.deleteConfirm", { name: pendingDelete.name }) }}</p>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="row confirm-actions">
        <button class="secondary" @click="cancelDelete">{{ t("common.cancel") }}</button>
        <button @click="confirmDelete"><i class="fa-regular fa-trash-can"></i> {{ t("common.delete") }}</button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import StatusBadge from "../components/StatusBadge.vue";
import { createForward, deleteForward, listMeForwards, listMeInstances, stopForward } from "../services/api";

const forwards = ref<any[]>([]);
const instances = ref<any[]>([]);
const form = ref({ instanceId: "", serviceName: "", portName: "", localPort: 30000 });
const status = ref("ALL");
const error = ref("");
const pendingDelete = ref<{ id: string; localPort: number } | null>(null);
const { t } = useI18n();

const filtered = computed(() => forwards.value.filter((f) => status.value === "ALL" || f.status === status.value));

async function refresh(): Promise<void> {
  forwards.value = await listMeForwards();
  instances.value = await listMeInstances();
}

async function createOne(): Promise<void> {
  await createForward({ ...form.value, localPort: Number(form.value.localPort), serviceName: form.value.serviceName || undefined });
  await refresh();
}

async function stopOne(id: string): Promise<void> {
  await stopForward(id);
  await refresh();
}

async function deleteOne(forward: { id: string; status: string; localPort: number }): Promise<void> {
  error.value = "";
  if (forward.status !== "STOPPED") {
    return;
  }

  pendingDelete.value = { id: forward.id, localPort: forward.localPort };
}

function cancelDelete(): void {
  pendingDelete.value = null;
}

async function confirmDelete(): Promise<void> {
  if (!pendingDelete.value) return;
  try {
    await deleteForward(pendingDelete.value.id);
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
    <h2><i class="fa-solid fa-arrow-right-arrow-left"></i> {{ t("forwards.title") }}</h2>
    <div class="row">
      <select v-model="form.instanceId"><option value="">{{ t("forwards.instance") }}</option><option v-for="i in instances" :key="i.id" :value="i.id">{{ i.name }}</option></select>
      <input v-model="form.serviceName" :placeholder="t('forwards.serviceOptional')" />
      <input v-model="form.portName" :placeholder="t('forwards.portName')" />
      <input v-model.number="form.localPort" type="number" :placeholder="t('forwards.localPort')" />
      <button @click="createOne"><i class="fa-solid fa-plus"></i> {{ t("forwards.create") }}</button>
    </div>

    <div class="row"><select v-model="status"><option>ALL</option><option>ACTIVE</option><option>REQUESTED</option><option>AGENT_OFFLINE</option><option>STOPPED</option></select></div>

    <table>
      <thead><tr><th>{{ t("forwards.local") }}</th><th>{{ t("forwards.remote") }}</th><th>{{ t("forwards.status") }}</th><th>{{ t("forwards.action") }}</th></tr></thead>
      <tbody>
        <tr v-for="f in filtered" :key="f.id">
          <td>127.0.0.1:{{ f.localPort }}</td>
          <td>{{ f.remoteHost }}:{{ f.remotePort }}</td>
          <td><StatusBadge :status="f.status" /></td>
          <td>
            <div class="row">
              <button class="secondary" @click="stopOne(f.id)"><i class="fa-solid fa-stop"></i> {{ t("common.stop") }}</button>
              <button v-if="f.status === 'STOPPED'" class="secondary" @click="deleteOne(f)"><i class="fa-regular fa-trash-can"></i> {{ t("common.delete") }}</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="error" class="error">{{ error }}</p>
  </section>

  <div v-if="pendingDelete" class="dialog-backdrop">
    <section class="card confirm-dialog">
      <h3><i class="fa-solid fa-triangle-exclamation"></i> {{ t("forwards.deleteDialogTitle") }}</h3>
      <p>{{ t("forwards.deleteConfirm", { port: pendingDelete.localPort }) }}</p>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="row confirm-actions">
        <button class="secondary" @click="cancelDelete">{{ t("common.cancel") }}</button>
        <button @click="confirmDelete"><i class="fa-regular fa-trash-can"></i> {{ t("common.delete") }}</button>
      </div>
    </section>
  </div>
</template>

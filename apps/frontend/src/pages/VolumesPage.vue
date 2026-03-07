<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { listMeInstances, listVolumes, startSync, stopSync } from "../services/api";

const volumes = ref<any[]>([]);
const instances = ref<any[]>([]);
const syncId = ref("");
const form = ref({ instanceVolumeId: "", localPath: "", sshHost: "", sshPort: 22, sshUsername: "", sshPassword: "", conflictPolicy: "PREFER_REMOTE" as "PREFER_LOCAL" | "PREFER_REMOTE" | "MANUAL" });
const { t } = useI18n();

const volumeOptions = computed(() =>
  instances.value.flatMap((i) => i.volumes.map((v: any) => ({ id: v.id, label: `${i.name} - ${v.serviceName}/${v.name}` })))
);

async function refresh(): Promise<void> {
  volumes.value = await listVolumes();
  instances.value = await listMeInstances();
}

async function startOne(): Promise<void> {
  const result = await startSync({ ...form.value, sshPort: Number(form.value.sshPort), sshPassword: form.value.sshPassword || undefined });
  syncId.value = result.syncId;
}

async function stopOne(): Promise<void> {
  if (!syncId.value) return;
  await stopSync(syncId.value);
  syncId.value = "";
}

onMounted(() => { void refresh(); });
</script>

<template>
  <section class="card">
    <h2><i class="fa-solid fa-hard-drive"></i> {{ t("volumes.title") }}</h2>
    <ul>
      <li v-for="v in volumes" :key="v.name">{{ v.name }} - {{ v.path }}</li>
    </ul>

    <h3>{{ t("volumes.startSync") }}</h3>
    <div class="row">
      <select v-model="form.instanceVolumeId"><option value="">{{ t("volumes.instanceVolume") }}</option><option v-for="o in volumeOptions" :key="o.id" :value="o.id">{{ o.label }}</option></select>
      <input v-model="form.localPath" placeholder="C:\\workspace\\project" />
      <input v-model="form.sshHost" :placeholder="t('volumes.sshHost')" />
      <input v-model.number="form.sshPort" type="number" />
      <input v-model="form.sshUsername" :placeholder="t('volumes.sshUser')" />
      <input v-model="form.sshPassword" type="password" :placeholder="t('volumes.sshPassword')" />
      <select v-model="form.conflictPolicy"><option value="PREFER_LOCAL">prefer-local</option><option value="PREFER_REMOTE">prefer-remote</option><option value="MANUAL">manual</option></select>
      <button @click="startOne"><i class="fa-solid fa-play"></i> {{ t("common.start") }}</button>
      <button class="secondary" @click="stopOne"><i class="fa-solid fa-stop"></i> {{ t("common.stop") }}</button>
    </div>
    <p v-if="syncId">{{ t("volumes.runningSync", { id: syncId }) }}</p>
  </section>
</template>

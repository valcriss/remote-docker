<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { getLogs, listMeInstances } from "../services/api";

const instances = ref<any[]>([]);
const selectedId = ref("");
const lines = ref<string[]>([]);
const search = ref("");
const paused = ref(false);
const { t } = useI18n();

const filtered = computed(() => lines.value.filter((line) => line.toLowerCase().includes(search.value.toLowerCase())));

async function init(): Promise<void> {
  instances.value = await listMeInstances();
}

async function loadLogs(): Promise<void> {
  if (!selectedId.value || paused.value) return;
  const data = await getLogs(selectedId.value);
  lines.value = data.lines;
}

function clearLogs(): void {
  lines.value = [];
}

function downloadLogs(): void {
  const blob = new Blob([lines.value.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `logs-${selectedId.value || "instance"}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

void init();
</script>

<template>
  <section class="card">
    <h2><i class="fa-regular fa-file-lines"></i> {{ t("logs.title") }}</h2>
    <div class="row">
      <select v-model="selectedId"><option value="">{{ t("logs.instance") }}</option><option v-for="i in instances" :key="i.id" :value="i.id">{{ i.name }}</option></select>
      <button @click="loadLogs"><i class="fa-solid fa-rotate-right"></i> {{ t("logs.refresh") }}</button>
      <input v-model="search" :placeholder="t('logs.search')" />
      <button class="secondary" @click="paused = !paused">{{ paused ? t("logs.resume") : t("logs.pause") }}</button>
      <button class="secondary" @click="clearLogs">{{ t("logs.clear") }}</button>
      <button class="secondary" @click="downloadLogs">{{ t("logs.download") }}</button>
    </div>
    <pre class="logs-box">{{ filtered.join('\n') }}</pre>
  </section>
</template>

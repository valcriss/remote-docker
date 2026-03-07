<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { meDashboard } from "../services/api";

const data = ref<any>(null);
const { t } = useI18n();

onMounted(async () => {
  data.value = await meDashboard();
});
</script>

<template>
  <section class="card">
    <h2><i class="fa-solid fa-chart-line"></i> {{ t("dashboard.title") }}</h2>
    <p>{{ t("dashboard.subtitle") }}</p>
    <div class="grid-2" v-if="data">
      <div class="card mini">
        <h3>{{ t("dashboard.statusBreakdown") }}</h3>
        <pre>{{ JSON.stringify(data.statusBreakdown, null, 2) }}</pre>
      </div>
      <div class="card mini">
        <h3>{{ t("dashboard.recentAudit") }}</h3>
        <ul>
          <li v-for="item in data.recentAudit" :key="item.id">{{ item.action }} - {{ item.createdAt }}</li>
        </ul>
      </div>
    </div>
  </section>
</template>

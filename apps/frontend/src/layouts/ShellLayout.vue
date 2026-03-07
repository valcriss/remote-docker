<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { adminDashboard, meDashboard } from "../services/api";
import { logout, useAuth } from "../composables/auth";

const router = useRouter();
const route = useRoute();
const auth = useAuth();
const { t } = useI18n();
const dashboard = ref<any>(null);
const showTopStats = computed(() => route.path !== "/catalog");

const criticalAlerts = computed(() => {
  const alerts: string[] = [];
  const statuses = dashboard.value?.statusBreakdown?.forwards ?? {};
  const problem = (statuses.AGENT_OFFLINE ?? 0) + (statuses.ERROR ?? 0);
  if (problem > 0) alerts.push(t("shell.forwardsAlert", { count: problem }));
  if (dashboard.value?.session?.status === "OFFLINE") alerts.push(t("shell.agentOffline"));
  return alerts;
});

async function refreshHeader(): Promise<void> {
  dashboard.value = auth.user?.role === "ADMIN" ? await adminDashboard() : await meDashboard();
}

function doLogout(): void {
  logout();
  void router.replace("/login");
}

onMounted(() => {
  void refreshHeader();
});
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="topbar-brand"><i class="fa-solid fa-cube"></i> Remote Docker</div>
      <div class="topbar-meta">{{ auth.user?.email }} ({{ auth.user?.role }})</div>
      <button class="secondary" @click="doLogout"><i class="fa-solid fa-right-from-bracket"></i> {{ t("common.logout") }}</button>
    </header>

    <div class="workspace">
      <aside class="sidebar">
        <h3>{{ t("nav.title") }}</h3>
        <nav>
          <RouterLink to="/dashboard"><i class="fa-solid fa-chart-line"></i> {{ t("nav.dashboard") }}</RouterLink>
          <RouterLink to="/catalog"><i class="fa-solid fa-layer-group"></i> {{ t("nav.catalog") }}</RouterLink>
          <RouterLink to="/instances"><i class="fa-solid fa-server"></i> {{ t("nav.instances") }}</RouterLink>
          <RouterLink to="/forwards"><i class="fa-solid fa-arrow-right-arrow-left"></i> {{ t("nav.forwards") }}</RouterLink>
          <RouterLink to="/volumes-sync"><i class="fa-solid fa-hard-drive"></i> {{ t("nav.volumes") }}</RouterLink>
          <RouterLink to="/logs"><i class="fa-regular fa-file-lines"></i> {{ t("nav.logs") }}</RouterLink>
          <RouterLink v-if="auth.user?.role === 'ADMIN'" to="/admin"><i class="fa-solid fa-user-shield"></i> {{ t("nav.admin") }}</RouterLink>
        </nav>
      </aside>

      <main class="content">
        <section class="kpi-row" v-if="dashboard && showTopStats">
          <article class="kpi-card">
            <label>{{ t("shell.instances") }}</label>
            <strong>{{ dashboard.counts?.instances ?? dashboard.instances ?? 0 }}</strong>
          </article>
          <article class="kpi-card">
            <label>{{ t("shell.forwards") }}</label>
            <strong>{{ dashboard.counts?.forwards ?? dashboard.forwards?.total ?? 0 }}</strong>
          </article>
          <article class="kpi-card">
            <label>{{ t("shell.session") }}</label>
            <strong>{{ dashboard.session?.status ?? dashboard.sessions?.online + '/' + dashboard.sessions?.total }}</strong>
          </article>
        </section>

        <section class="card alert-card" v-if="criticalAlerts.length">
          <h2><i class="fa-solid fa-triangle-exclamation"></i> {{ t("shell.alertsTitle") }}</h2>
          <ul>
            <li v-for="alert in criticalAlerts" :key="alert">{{ alert }}</li>
          </ul>
        </section>

        <RouterView />
      </main>
    </div>
  </div>
</template>

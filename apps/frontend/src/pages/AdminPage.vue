<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { listAdminAudit, listAdminSessions, listAdminUsers, meDashboard } from "../services/api";

const mode = ref<"ME" | "ALL">("ALL");
const sessions = ref<any[]>([]);
const users = ref<any[]>([]);
const audit = ref<any[]>([]);
const me = ref<any>(null);
const { t } = useI18n();

const visibleSessions = computed(() => mode.value === "ALL" ? sessions.value : sessions.value.filter((s) => s.user.id === me.value?.session?.userId));

async function refresh(): Promise<void> {
  [sessions.value, users.value, audit.value, me.value] = await Promise.all([
    listAdminSessions(),
    listAdminUsers(),
    listAdminAudit(),
    meDashboard()
  ]);
}

onMounted(() => { void refresh(); });
</script>

<template>
  <section class="card">
    <div class="section-head"><h2><i class="fa-solid fa-user-shield"></i> {{ t("admin.title") }}</h2><select v-model="mode"><option value="ME">{{ t("admin.myScope") }}</option><option value="ALL">{{ t("admin.allUsers") }}</option></select></div>

    <h3>{{ t("admin.sessions") }}</h3>
    <table>
      <thead><tr><th>{{ t("admin.user") }}</th><th>{{ t("admin.status") }}</th><th>{{ t("admin.hostname") }}</th><th>{{ t("admin.lastSeen") }}</th></tr></thead>
      <tbody>
        <tr v-for="s in visibleSessions" :key="s.id"><td>{{ s.user.email }}</td><td>{{ s.status }}</td><td>{{ s.hostname }}</td><td>{{ s.lastSeenAt }}</td></tr>
      </tbody>
    </table>

    <h3>{{ t("admin.users") }}</h3>
    <table>
      <thead><tr><th>{{ t("admin.email") }}</th><th>{{ t("admin.role") }}</th><th>{{ t("admin.created") }}</th></tr></thead>
      <tbody>
        <tr v-for="u in users" :key="u.id"><td>{{ u.email }}</td><td>{{ u.role }}</td><td>{{ u.createdAt }}</td></tr>
      </tbody>
    </table>

    <h3>{{ t("admin.audit") }}</h3>
    <table>
      <thead><tr><th>{{ t("admin.action") }}</th><th>{{ t("admin.target") }}</th><th>{{ t("admin.actor") }}</th><th>{{ t("admin.at") }}</th></tr></thead>
      <tbody>
        <tr v-for="a in audit" :key="a.id"><td>{{ a.action }}</td><td>{{ a.targetType }}</td><td>{{ a.actorUserId }}</td><td>{{ a.createdAt }}</td></tr>
      </tbody>
    </table>
  </section>
</template>

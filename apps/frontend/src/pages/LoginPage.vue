<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { login, register } from "../services/api";
import { onLogin } from "../composables/auth";

const router = useRouter();
const mode = ref<"login" | "register">("login");
const role = ref<"USER" | "ADMIN">("USER");
const email = ref("admin@example.com");
const password = ref("password123");
const error = ref("");
const { t } = useI18n();

async function submit(): Promise<void> {
  error.value = "";
  try {
    const result = mode.value === "login"
      ? await login(email.value, password.value)
      : await register(email.value, password.value, role.value);

    await onLogin(result.token);
    await router.replace("/dashboard");
  } catch (e: any) {
    error.value = e?.message ?? t("login.authFailed");
  }
}
</script>

<template>
  <div class="login-wrap">
    <section class="card auth-card">
      <h1><i class="fa-solid fa-cube"></i> Remote Docker</h1>
      <p>{{ t("login.subtitle") }}</p>
      <div class="row">
        <button :class="{ secondary: mode !== 'login' }" @click="mode = 'login'">{{ t("login.login") }}</button>
        <button :class="{ secondary: mode !== 'register' }" @click="mode = 'register'">{{ t("login.register") }}</button>
      </div>
      <div class="row">
        <input v-model="email" :placeholder="t('login.email')" />
        <input v-model="password" type="password" :placeholder="t('login.password')" />
        <select v-if="mode === 'register'" v-model="role">
          <option value="USER">USER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <button @click="submit">{{ t("login.submit") }}</button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </section>
  </div>
</template>

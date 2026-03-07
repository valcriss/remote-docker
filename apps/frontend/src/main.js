import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";
import { bootstrapAuth } from "./composables/auth";
import { i18n } from "./i18n";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./styles.css";
async function start() {
    await bootstrapAuth();
    createApp(App).use(router).use(i18n).mount("#app");
}
void start();

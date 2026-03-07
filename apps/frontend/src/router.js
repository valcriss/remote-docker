import { createRouter, createWebHistory } from "vue-router";
import { useAuth } from "./composables/auth";
import LoginPage from "./pages/LoginPage.vue";
import ShellLayout from "./layouts/ShellLayout.vue";
import DashboardPage from "./pages/DashboardPage.vue";
import CatalogPage from "./pages/CatalogPage.vue";
import InstancesPage from "./pages/InstancesPage.vue";
import ForwardsPage from "./pages/ForwardsPage.vue";
import VolumesPage from "./pages/VolumesPage.vue";
import LogsPage from "./pages/LogsPage.vue";
import AdminPage from "./pages/AdminPage.vue";
export const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: "/login", component: LoginPage },
        {
            path: "/",
            component: ShellLayout,
            children: [
                { path: "", redirect: "/dashboard" },
                { path: "/dashboard", component: DashboardPage },
                { path: "/catalog", component: CatalogPage },
                { path: "/instances", component: InstancesPage },
                { path: "/forwards", component: ForwardsPage },
                { path: "/volumes-sync", component: VolumesPage },
                { path: "/logs", component: LogsPage },
                { path: "/admin", component: AdminPage }
            ]
        }
    ]
});
router.beforeEach((to) => {
    const auth = useAuth();
    if (!auth.ready) {
        return true;
    }
    if (!auth.user && to.path !== "/login") {
        return "/login";
    }
    if (auth.user && to.path === "/login") {
        return "/dashboard";
    }
    if (to.path === "/admin" && auth.user?.role !== "ADMIN") {
        return "/dashboard";
    }
    return true;
});

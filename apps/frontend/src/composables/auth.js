import { reactive, readonly } from "vue";
import { me, setToken } from "../services/api";
const state = reactive({
    token: localStorage.getItem("rd_token"),
    user: null,
    ready: false
});
export async function bootstrapAuth() {
    if (!state.token) {
        state.ready = true;
        return;
    }
    try {
        setToken(state.token);
        state.user = await me();
    }
    catch {
        logout();
    }
    finally {
        state.ready = true;
    }
}
export function useAuth() {
    return readonly(state);
}
export async function onLogin(token) {
    state.token = token;
    localStorage.setItem("rd_token", token);
    setToken(token);
    state.user = await me();
}
export function logout() {
    state.token = null;
    state.user = null;
    localStorage.removeItem("rd_token");
    setToken(null);
}

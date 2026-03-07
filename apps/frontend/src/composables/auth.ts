import { reactive, readonly } from "vue";
import { me, setToken } from "../services/api";

interface AuthState {
  token: string | null;
  user: { id: string; email: string; role: "USER" | "ADMIN" } | null;
  ready: boolean;
}

const state = reactive<AuthState>({
  token: localStorage.getItem("rd_token"),
  user: null,
  ready: false
});

export async function bootstrapAuth(): Promise<void> {
  if (!state.token) {
    state.ready = true;
    return;
  }

  try {
    setToken(state.token);
    state.user = await me();
  } catch {
    logout();
  } finally {
    state.ready = true;
  }
}

export function useAuth() {
  return readonly(state);
}

export async function onLogin(token: string): Promise<void> {
  state.token = token;
  localStorage.setItem("rd_token", token);
  setToken(token);
  state.user = await me();
}

export function logout(): void {
  state.token = null;
  state.user = null;
  localStorage.removeItem("rd_token");
  setToken(null);
}
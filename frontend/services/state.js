// ─── Global State ─────────────────────────────────────────────────────────────

const { reactive } = Vue;

const appState = reactive({
  token: localStorage.getItem('ml_token') || null,
  user:  JSON.parse(localStorage.getItem('ml_user') || 'null'),
  unreadCount: 0,
  toast: null,
});

// Expose globally so api.js can read it (no circular import needed)
window.appState = appState;

function showToast(message, type = 'success') {
  appState.toast = { message, type };
  setTimeout(() => { appState.toast = null; }, 3500);
}

function setAuth(token, user) {
  appState.token = token;
  appState.user  = user;
  localStorage.setItem('ml_token', token);
  localStorage.setItem('ml_user', JSON.stringify(user));
}

function clearAuth() {
  appState.token = null;
  appState.user  = null;
  localStorage.removeItem('ml_token');
  localStorage.removeItem('ml_user');
}

export { appState, showToast, setAuth, clearAuth };

// ─── Global State ─────────────────────────────────────────────────────────────

const { reactive } = Vue;

// Safely read token from localStorage — guard against literal "null" / "undefined"
function readStoredToken() {
  const raw = localStorage.getItem('ml_token');
  if (!raw || raw === 'null' || raw === 'undefined' || raw.trim() === '') return null;
  return raw.trim();
}

function readStoredUser() {
  try {
    const raw = localStorage.getItem('ml_user');
    if (!raw || raw === 'null' || raw === 'undefined') return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const appState = reactive({
  token:       readStoredToken(),
  user:        readStoredUser(),
  unreadCount: 0,
  toast:       null,
});

// Expose globally so api.js can access it without circular ES-module imports
window.appState = appState;

function showToast(message, type = 'success') {
  appState.toast = { message, type };
  setTimeout(() => { appState.toast = null; }, 3500);
}

function setAuth(token, user) {
  if (!token || typeof token !== 'string') {
    console.error('[state] setAuth called with invalid token:', token);
    return;
  }
  appState.token = token.trim();
  appState.user  = user;
  localStorage.setItem('ml_token', token.trim());
  localStorage.setItem('ml_user', JSON.stringify(user));
  // Keep window.appState in sync (it's the same reactive object, but be explicit)
  window.appState.token = token.trim();
}

function clearAuth() {
  appState.token       = null;
  appState.user        = null;
  appState.unreadCount = 0;
  window.appState.token = null;
  localStorage.removeItem('ml_token');
  localStorage.removeItem('ml_user');
}

export { appState, showToast, setAuth, clearAuth };

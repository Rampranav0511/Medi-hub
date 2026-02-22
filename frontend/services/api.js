// ─── Medilocker API Service ───────────────────────────────────────────────────
// The backend uses Firebase Admin SDK's auth.verifyIdToken() on every request.
// This means EVERY API call must carry a valid Firebase ID token as:
//   Authorization: Bearer <firebase-id-token>
//
// Firebase ID tokens expire after 1 hour. We call getIdToken(false) which
// returns the cached token or refreshes it automatically if it's close to expiry.

const API_BASE = (
  window.__API_BASE__ ||
  localStorage.getItem('ml_api_base') ||
  (window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api'
    : `${window.location.origin}/api`)
).replace(/\/+$/, '');

async function getToken() {
  // Always prefer a live Firebase token — Firebase SDK auto-refreshes when needed
  if (window._firebaseAuth?.currentUser) {
    try {
      // false = use cached token if still valid; Firebase refreshes automatically
      const token = await window._firebaseAuth.currentUser.getIdToken(false);
      if (token && token.trim().length > 10) {
        // Keep appState in sync so the rest of the app can check auth state
        if (window.appState) window.appState.token = token.trim();
        localStorage.setItem('ml_token', token.trim());
        return token.trim();
      }
    } catch (e) {
      console.error('[api] Firebase getIdToken failed:', e.code || e.message);
      // Token is irrecoverable — force re-login
      if (window.appState) {
        window.appState.token = null;
        window.appState.user = null;
        window.appState.unreadCount = 0;
      }
      localStorage.removeItem('ml_token');
      localStorage.removeItem('ml_user');
      throw new Error('Session expired. Please sign in again.');
    }
  }

  // Fallback: use stored token (e.g. page was just refreshed before Firebase re-initialised)
  const stored = localStorage.getItem('ml_token');
  if (stored && stored !== 'null' && stored !== 'undefined' && stored.trim().length > 10) {
    return stored.trim();
  }

  return null;
}

async function request(method, endpoint, data = null, isMultipart = false) {
  const token = await getToken();

  const headers = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    // No token available — this request will 401. Log it clearly.
    console.warn(`[api] No auth token for ${method} ${endpoint}. Is Firebase configured?`);
  }

  if (!isMultipart && data !== null) {
    headers['Content-Type'] = 'application/json';
  }

  const opts = { method, headers };
  if (data !== null) {
    opts.body = isMultipart ? data : JSON.stringify(data);
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, opts);
  } catch {
    throw new Error('Network error — is the backend running on port 3000?');
  }

  // Parse JSON body if present
  const contentType = res.headers.get('content-type') || '';
  let json = {};
  if (contentType.includes('application/json')) {
    try { json = await res.json(); } catch { json = {}; }
  } else if (res.ok) {
    return {}; // 204 No Content etc.
  }

  if (!res.ok) {
    const msg = json.error || json.message || `HTTP ${res.status}`;
    if (res.status === 401) {
      // Wipe stale credentials and force re-login
      if (window.appState) {
        window.appState.token = null;
        window.appState.user = null;
        window.appState.unreadCount = 0;
      }
      localStorage.removeItem('ml_token');
      localStorage.removeItem('ml_user');
    }
    const err = new Error(msg);
    err.status = res.status;
    if (Array.isArray(json.errors)) err.details = json.errors;
    throw err;
  }

  return json;
}

const api = {
  get:      (ep)     => request('GET',    ep),
  post:     (ep, d)  => request('POST',   ep, d),
  patch:    (ep, d)  => request('PATCH',  ep, d),
  delete:   (ep)     => request('DELETE', ep),
  postFile: (ep, fd) => request('POST',   ep, fd, true),
};

export default api;

// ─── Medilocker API Service ───────────────────────────────────────────────────
// All requests go to http://localhost:3000/api
// Token is read from appState at call time so it's always fresh

const API_BASE = 'http://localhost:3000/api';

async function getToken() {
  // If Firebase is loaded and a user is signed in, always get a fresh token.
  // Firebase refreshes it internally if it's close to expiry.
  if (window._firebaseAuth?.currentUser) {
    const token = await window._firebaseAuth.currentUser.getIdToken(false);
    window.appState.token = token;
    localStorage.setItem('ml_token', token);
    return token;
  }
  return window.appState?.token || null;
}

async function request(method, endpoint, data = null, isMultipart = false) {
  const token = await getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isMultipart) headers['Content-Type'] = 'application/json';

  const opts = { method, headers };
  if (data) opts.body = isMultipart ? data : JSON.stringify(data);

  const res = await fetch(`${API_BASE}${endpoint}`, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || json.message || `HTTP ${res.status}`);
  return json;
}

const api = {
  get:      (ep)         => request('GET',    ep),
  post:     (ep, d)      => request('POST',   ep, d),
  patch:    (ep, d)      => request('PATCH',  ep, d),
  delete:   (ep)         => request('DELETE', ep),
  postFile: (ep, fd)     => request('POST',   ep, fd, true),
};

export default api;

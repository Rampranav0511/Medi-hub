// ─── Medilocker — main.js ─────────────────────────────────────────────────────
// Entry point. Boots Vue, wires the router, and periodically refreshes
// the notification badge count while the user is logged in.

import { router }           from './router.js';
import { appState }         from './services/state.js';
import api                  from './services/api.js';

const { createApp, onMounted } = Vue;

const App = {
  setup() {
    onMounted(async () => {
      if (!appState.token) return;

      // Initial unread count
      try {
        const { unreadCount } = await api.get('/notifications');
        appState.unreadCount = unreadCount ?? 0;
      } catch { /* ignore if token not yet valid */ }

      // Poll every 60 seconds while the tab is active
      setInterval(async () => {
        if (!appState.token) return;
        try {
          const { unreadCount } = await api.get('/notifications');
          appState.unreadCount = unreadCount ?? 0;
        } catch { /* silent */ }
      }, 60_000);
    });

    return {};
  },
  template: `<router-view />`,
};

const app = createApp(App);
app.use(router);
app.mount('#app');

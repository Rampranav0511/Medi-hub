// ─── App Layout ───────────────────────────────────────────────────────────────
import { Sidebar } from './Sidebar.js';
import { Toast }   from './Toast.js';
import { appState } from '../services/state.js';

export const AppLayout = {
  components: { Sidebar, Toast },
  setup() { return { appState }; },
  template: `
    <div class="flex min-h-screen">
      <div class="hidden md:flex flex-col border-r border-ink-800 sticky top-0 h-screen">
        <Sidebar />
      </div>
      <main class="flex-1 overflow-auto">
        <router-view />
      </main>
    </div>
    <Toast />
  `,
};

// ─── Toast Component ──────────────────────────────────────────────────────────
import { appState } from '../services/state.js';

export const Toast = {
  setup() { return { appState }; },
  template: `
    <transition name="slide-toast">
      <div v-if="appState.toast"
        class="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-xl"
        :class="appState.toast.type === 'error'
          ? 'bg-[#1a0f0f] border-red-900/50 text-red-400'
          : 'bg-[#0f1a0f] border-sage-700/50 text-sage-300'">
        <span class="text-lg">{{ appState.toast.type === 'error' ? '⚠' : '✓' }}</span>
        <span class="text-sm font-medium">{{ appState.toast.message }}</span>
      </div>
    </transition>
  `,
};

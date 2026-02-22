// ─── Collaborators View (Patient) ─────────────────────────────────────────────
import api from '../services/api.js';
import { appState, showToast } from '../services/state.js';
import { daysLeft } from '../utils/time.js';

const { ref, onMounted, defineComponent } = Vue;

export const CollaboratorsView = defineComponent({
  name: 'CollaboratorsView',
  setup() {
    const collaborators = ref([]);
    const loading       = ref(true);

    onMounted(async () => {
      try {
        const { collaborators: data } = await api.get(`/patients/${appState.user.uid}/collaborators`);
        collaborators.value = data || [];
      } catch (e) {
        showToast(e.message, 'error');
      } finally {
        loading.value = false;
      }
    });

    function expiryColor(days) {
      if (days <= 3)  return 'text-red-400';
      if (days <= 7)  return 'text-amber-400';
      return 'text-sage-400';
    }

    function expiryBarColor(days) {
      if (days <= 3)  return '#7f1d1d';
      if (days <= 7)  return '#78350f';
      return '#1f3d1f';
    }

    async function revoke(collab) {
      if (!confirm(`Revoke access for ${collab.doctor?.displayName || 'this doctor'}?`)) return;
      try {
        await api.patch(`/access-requests/${collab.accessRequest.id}/revoke`, {});
        collaborators.value = collaborators.value.filter(c => c !== collab);
        showToast('Access revoked');
      } catch (e) {
        showToast(e.message, 'error');
      }
    }

    return { collaborators, loading, daysLeft, expiryColor, expiryBarColor, revoke };
  },

  template: `
    <div class="p-6 max-w-4xl mx-auto animate-fade-in">
      <div class="mb-8">
        <p class="mono text-ink-500 text-xs mb-1">— Contributors</p>
        <h1 class="serif text-3xl text-ink-100">Collaborators</h1>
        <p class="text-sm text-ink-500 mt-1">Doctors with active access to your records</p>
      </div>

      <div v-if="loading" class="grid md:grid-cols-2 gap-3">
        <div v-for="i in 3" :key="i" class="card p-5 animate-pulse">
          <div class="h-4 w-1/2 bg-ink-800 rounded mb-3"></div>
          <div class="h-3 w-3/4 bg-ink-800 rounded mb-2"></div>
          <div class="h-8 bg-ink-800 rounded"></div>
        </div>
      </div>

      <div v-else-if="collaborators.length === 0" class="card p-12 text-center">
        <div class="text-4xl mb-3 text-ink-700">◎</div>
        <p class="text-ink-500">No active collaborators</p>
        <p class="text-xs text-ink-700 mono mt-1">Doctors you approve will appear here</p>
      </div>

      <div v-else class="grid md:grid-cols-2 gap-3">
        <div v-for="collab in collaborators" :key="collab.doctor?.uid || collab.id" class="card p-5">
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-sage-900/50 border border-sage-700/30 flex items-center justify-center text-sage-400 font-serif">
                {{ ((collab.doctor?.displayName || '?')[0] || '?').toUpperCase() }}
              </div>
              <div>
                <h3 class="text-sm font-medium text-ink-100">{{ collab.doctor?.displayName || 'Unknown Doctor' }}</h3>
                <p class="mono text-xs text-ink-600">{{ collab.doctor?.specialization || '—' }}</p>
              </div>
            </div>
            <span class="mono text-xs px-2 py-0.5 rounded border"
              :class="collab.accessRequest?.accessLevel === 'read_write'
                ? 'border-amber-800/40 text-amber-500 bg-amber-900/10'
                : 'border-ink-700 text-ink-500'">
              {{ collab.accessRequest?.accessLevel || 'read' }}
            </span>
          </div>

          <div class="flex flex-wrap gap-1 mb-3">
            <span v-for="t in (collab.accessRequest?.requestedRecordTypes || [])" :key="t"
              class="tag-badge">{{ t.replace(/_/g,' ') }}</span>
          </div>

          <div class="flex items-center justify-between">
            <span class="mono text-xs" :class="expiryColor(daysLeft(collab.accessRequest?.expiresAt))">
              {{ daysLeft(collab.accessRequest?.expiresAt) }}d remaining
            </span>
            <button @click="revoke(collab)" class="btn-danger text-xs py-1 px-3">⊗ Revoke</button>
          </div>

          <!-- Expiry bar -->
          <div class="mt-3 h-0.5 bg-ink-800 rounded overflow-hidden">
            <div class="h-full rounded transition-all"
              :style="{
                width: Math.min(100, Math.max(0, (daysLeft(collab.accessRequest?.expiresAt) / 30) * 100)) + '%',
                background: expiryBarColor(daysLeft(collab.accessRequest?.expiresAt))
              }"></div>
          </div>
        </div>
      </div>
    </div>
  `,
});

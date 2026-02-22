// ─── Dashboard View ───────────────────────────────────────────────────────────
import api from '../services/api.js';
import { appState, showToast } from '../services/state.js';
import { relativeTime } from '../utils/time.js';

const { ref, onMounted, defineComponent } = Vue;
const { useRouter } = VueRouter;

export const DashboardView = defineComponent({
  name: 'DashboardView',
  setup() {
    const router         = useRouter();
    const stats          = ref(null);
    const recentActivity = ref([]);
    const loading        = ref(true);
    const isPatient      = appState.user?.role === 'patient';

    onMounted(async () => {
      try {
        const profileRes = await api.get('/auth/me');
        const p = profileRes.profile || {};

        if (isPatient) {
          const reqRes = await api.get('/access-requests/incoming').catch(() => ({ requests: [] }));
          const pending = (reqRes.requests || []).filter(r => r.status === 'pending').length;

          stats.value = {
            totalRecords:        p.totalRecords        ?? 0,
            totalVersions:       p.totalVersions       ?? 0,
            activeCollaborators: p.activeCollaborators ?? 0,
            pendingRequests:     pending,
          };

          const commitRes = await api.get(`/patients/${appState.user.uid}/commits`).catch(() => ({ commits: [] }));
          recentActivity.value = (commitRes.commits || []).slice(0, 5).map(c => ({
            id:       c.id,
            label:    c.committedByRole === 'doctor' ? 'Dr. committed to' : 'You uploaded',
            resource: c.commitMessage || c.title || 'a record',
            time:     relativeTime(c.createdAt),
            type:     c.committedByRole === 'doctor' ? 'doctor' : 'self',
          }));

        } else {
          // Doctor dashboard
          stats.value = p.stats ?? {
            totalCasesHandled: 0, activeCases: 0,
            averageResponseTimeHours: 0, recordAccuracyScore: 0, endorsements: 0,
          };

          const notifRes = await api.get('/notifications').catch(() => ({ notifications: [] }));
          recentActivity.value = (notifRes.notifications || []).slice(0, 5).map(n => ({
            id:       n.id,
            label:    n.title || 'Notification',
            resource: n.body  || '',
            time:     relativeTime(n.createdAt),
            type:     n.type === 'endorsement'   ? 'endorse'
                    : n.type === 'access_request' ? 'request'
                    : 'approve',
          }));
        }
      } catch (e) {
        showToast(e.message, 'error');
      } finally {
        loading.value = false;
      }
    });

    const activityIcon = (type) => ({
      doctor:  '◈', self: '⊕', request: '⊘', approve: '✓', endorse: '★',
    }[type] || '◌');

    const activityColor = (type) => ({
      doctor: 'text-sage-400', self: 'text-ink-400', request: 'text-rust-400',
      approve: 'text-sage-500', endorse: 'text-amber-400',
    }[type] || 'text-ink-500');

    return { stats, recentActivity, loading, isPatient, activityIcon, activityColor, appState, router };
  },

  template: `
    <div class="p-6 max-w-5xl mx-auto animate-fade-in">
      <div class="mb-8">
        <p class="mono text-ink-500 text-xs mb-1">— Overview</p>
        <h1 class="serif text-3xl text-ink-100">
          Good day, {{ (appState.user?.displayName || '').split(' ')[0] || 'there' }}
        </h1>
        <p class="text-sm text-ink-500 mt-1">
          {{ new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) }}
        </p>
      </div>

      <!-- Stats skeleton -->
      <div v-if="loading" class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <div v-for="i in 4" :key="i" class="stat-card animate-pulse h-20"></div>
      </div>

      <!-- Patient stats -->
      <div v-else-if="stats && isPatient" class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <div class="stat-card">
          <div class="mono text-2xl text-ink-100 font-medium">{{ stats.totalRecords }}</div>
          <div class="mono text-[10px] text-ink-600 mt-1">Total Records</div>
        </div>
        <div class="stat-card">
          <div class="mono text-2xl text-sage-400 font-medium">{{ stats.totalVersions }}</div>
          <div class="mono text-[10px] text-ink-600 mt-1">Commits</div>
        </div>
        <div class="stat-card">
          <div class="mono text-2xl text-ink-100 font-medium">{{ stats.activeCollaborators }}</div>
          <div class="mono text-[10px] text-ink-600 mt-1">Collaborators</div>
        </div>
        <div class="stat-card">
          <div class="mono text-2xl font-medium" :class="stats.pendingRequests > 0 ? 'text-rust-400' : 'text-ink-400'">
            {{ stats.pendingRequests }}
          </div>
          <div class="mono text-[10px] text-ink-600 mt-1">Pending Requests</div>
        </div>
      </div>

      <!-- Doctor stats -->
      <div v-else-if="stats && !isPatient" class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        <div class="stat-card">
          <div class="mono text-2xl text-ink-100 font-medium">{{ stats.totalCasesHandled ?? 0 }}</div>
          <div class="mono text-[10px] text-ink-600 mt-1">Total Cases</div>
        </div>
        <div class="stat-card">
          <div class="mono text-2xl text-sage-400 font-medium">{{ stats.activeCases ?? 0 }}</div>
          <div class="mono text-[10px] text-ink-600 mt-1">Active</div>
        </div>
        <div class="stat-card">
          <div class="mono text-2xl text-ink-100 font-medium">{{ stats.averageResponseTimeHours ?? 0 }}h</div>
          <div class="mono text-[10px] text-ink-600 mt-1">Avg Response</div>
        </div>
        <div class="stat-card">
          <div class="mono text-2xl text-sage-400 font-medium">{{ stats.recordAccuracyScore ?? 0 }}</div>
          <div class="mono text-[10px] text-ink-600 mt-1">Accuracy</div>
        </div>
        <div class="stat-card">
          <div class="mono text-2xl text-ink-100 font-medium">{{ stats.endorsements ?? 0 }}</div>
          <div class="mono text-[10px] text-ink-600 mt-1">Endorsements</div>
        </div>
      </div>

      <!-- Activity feed -->
      <div class="card p-5">
        <p class="mono text-xs text-ink-600 uppercase tracking-wider mb-4">Recent Activity</p>
        <div v-if="loading" class="space-y-4">
          <div v-for="i in 3" :key="i" class="flex gap-3 animate-pulse">
            <div class="w-7 h-7 rounded-full bg-ink-800 flex-shrink-0"></div>
            <div class="flex-1">
              <div class="h-3 w-3/4 bg-ink-800 rounded mb-2"></div>
              <div class="h-2 w-1/4 bg-ink-800 rounded"></div>
            </div>
          </div>
        </div>
        <div v-else-if="recentActivity.length === 0" class="text-center py-8">
          <div class="text-3xl text-ink-800 mb-2">◌</div>
          <p class="text-ink-600 text-sm">No recent activity</p>
        </div>
        <div v-else class="space-y-4">
          <div v-for="item in recentActivity" :key="item.id" class="flex gap-3">
            <div class="w-7 h-7 rounded-full bg-ink-800 border border-ink-700 flex items-center justify-center flex-shrink-0"
              :class="activityColor(item.type)">
              <span class="text-xs">{{ activityIcon(item.type) }}</span>
            </div>
            <div class="flex-1 min-w-0 pt-0.5">
              <p class="text-sm text-ink-300">
                <span class="text-ink-500">{{ item.label }}</span>
                {{ ' ' }}
                <span class="text-ink-200 font-medium">{{ item.resource }}</span>
              </p>
              <p class="mono text-xs text-ink-700 mt-0.5">{{ item.time }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick actions -->
      <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
        <button v-if="isPatient" @click="router.push('/records')"
          class="card p-4 text-left hover:border-sage-800/40 transition-all cursor-pointer">
          <div class="text-sage-400 text-xl mb-1">⊕</div>
          <div class="text-sm text-ink-200 font-medium">Upload Record</div>
          <div class="mono text-xs text-ink-600 mt-0.5">Commit new file</div>
        </button>
        <button v-if="!isPatient" @click="router.push('/access-requests')"
          class="card p-4 text-left hover:border-sage-800/40 transition-all cursor-pointer">
          <div class="text-rust-400 text-xl mb-1">⊘</div>
          <div class="text-sm text-ink-200 font-medium">Request Access</div>
          <div class="mono text-xs text-ink-600 mt-0.5">Open a pull request</div>
        </button>
        <button @click="router.push('/doctors')"
          class="card p-4 text-left hover:border-sage-800/40 transition-all cursor-pointer">
          <div class="text-ink-400 text-xl mb-1">⊙</div>
          <div class="text-sm text-ink-200 font-medium">Find Doctors</div>
          <div class="mono text-xs text-ink-600 mt-0.5">Browse contributors</div>
        </button>
        <button @click="router.push('/notifications')"
          class="card p-4 text-left hover:border-sage-800/40 transition-all cursor-pointer">
          <div class="text-ink-400 text-xl mb-1">◉</div>
          <div class="text-sm text-ink-200 font-medium">Notifications</div>
          <div class="mono text-xs text-ink-600 mt-0.5">{{ appState.unreadCount }} unread</div>
        </button>
      </div>
    </div>
  `,
});

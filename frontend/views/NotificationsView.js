// ─── Notifications View ───────────────────────────────────────────────────────
import api from '../services/api.js';
import { appState, showToast } from '../services/state.js';
import { relativeTime } from '../utils/time.js';

const { ref, onMounted } = Vue;

const TYPE_ICON = {
  access_request:          '⊘',
  access_request_response: '✓',
  access_revoked:          '⊗',
  endorsement:             '★',
  record_updated:          '◈',
};

const TYPE_COLOR = {
  access_request:          'text-rust-400',
  access_request_response: 'text-sage-400',
  access_revoked:          'text-red-400',
  endorsement:             'text-amber-400',
  record_updated:          'text-ink-400',
};

export const NotificationsView = {
  setup() {
    const notifications = ref([]);
    const loading       = ref(true);

    onMounted(async () => {
      try {
        const { notifications: data, unreadCount } = await api.get('/notifications');
        notifications.value = data || [];
        appState.unreadCount = unreadCount ?? notifications.value.filter(n => !n.isRead).length;
      } catch (e) {
        showToast(e.message, 'error');
      } finally {
        loading.value = false;
      }
    });

    async function markRead(n) {
      if (n.isRead) return;
      try {
        await api.patch(`/notifications/${n.id}/read`, {});
        n.isRead = true;
        appState.unreadCount = Math.max(0, appState.unreadCount - 1);
      } catch {
        // Silent — UX already updated
        n.isRead = true;
      }
    }

    async function markAllRead() {
      try {
        await api.patch('/notifications/read-all', {});
        notifications.value.forEach(n => n.isRead = true);
        appState.unreadCount = 0;
        showToast('All notifications marked as read');
      } catch (e) {
        showToast(e.message, 'error');
      }
    }

    const typeIcon  = (t) => TYPE_ICON[t]  || '◌';
    const typeColor = (t) => TYPE_COLOR[t] || 'text-ink-400';

    return { notifications, loading, markRead, markAllRead, relativeTime, typeIcon, typeColor };
  },

  template: `
    <div class="p-6 max-w-3xl mx-auto animate-fade-in">
      <div class="flex items-center justify-between mb-8">
        <div>
          <p class="mono text-ink-500 text-xs mb-1">— Inbox</p>
          <h1 class="serif text-3xl text-ink-100">Notifications</h1>
        </div>
        <button @click="markAllRead" class="btn-ghost text-xs mono">✓ Mark all read</button>
      </div>

      <div v-if="loading" class="space-y-3">
        <div v-for="i in 4" :key="i" class="card p-4 animate-pulse">
          <div class="flex gap-3">
            <div class="w-9 h-9 rounded-full bg-ink-800 flex-shrink-0"></div>
            <div class="flex-1">
              <div class="h-3 w-1/2 bg-ink-800 rounded mb-2"></div>
              <div class="h-2 w-3/4 bg-ink-800 rounded"></div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="notifications.length === 0" class="card p-12 text-center">
        <div class="text-4xl text-ink-800 mb-3">◉</div>
        <p class="text-ink-500">No notifications yet</p>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="notif in notifications" :key="notif.id"
          class="card p-4 cursor-pointer group transition-all"
          :class="!notif.isRead ? 'border-sage-900/40 bg-sage-950/10' : ''"
          @click="markRead(notif)">
          <div class="flex gap-3">
            <div class="flex-shrink-0">
              <div class="w-9 h-9 rounded-full bg-ink-800 border border-ink-700 flex items-center justify-center"
                :class="typeColor(notif.type)">
                <span class="text-sm">{{ typeIcon(notif.type) }}</span>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2">
                <h3 class="text-sm font-medium" :class="!notif.isRead ? 'text-ink-100' : 'text-ink-400'">
                  {{ notif.title }}
                </h3>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <span v-if="!notif.isRead" class="notification-dot"></span>
                  <span class="mono text-xs text-ink-700">{{ relativeTime(notif.createdAt) }}</span>
                </div>
              </div>
              <p class="text-xs text-ink-500 mt-0.5">{{ notif.body }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
};

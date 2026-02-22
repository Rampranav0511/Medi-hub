// ─── Access Requests View ─────────────────────────────────────────────────────
import api from '../services/api.js';
import { appState, showToast } from '../services/state.js';
import { relativeTime, daysUntil } from '../utils/time.js';

const { ref, reactive, onMounted, defineComponent } = Vue;

const RECORD_TYPES = ['prescription','lab_report','xray','discharge_summary','vaccination','imaging','other','all'];

export const AccessRequestsView = defineComponent({
  name: 'AccessRequestsView',
  setup() {
    const requests          = ref([]);
    const loading           = ref(true);
    const activeTab         = ref(appState.user?.role === 'patient' ? 'incoming' : 'outgoing');
    const showRequestModal  = ref(false);
    const submitting        = ref(false);
    const isPatient         = appState.user?.role === 'patient';

    const requestForm = reactive({
      patientId: '', reason: '',
      accessLevel: 'read', requestedRecordTypes: ['lab_report'], expiryDays: 30,
    });

    async function loadRequests() {
      loading.value = true;
      try {
        const endpoint = isPatient ? '/access-requests/incoming' : '/access-requests/outgoing';
        const { requests: data } = await api.get(endpoint);
        requests.value = data || [];
      } catch (e) {
        showToast(e.message, 'error');
      } finally {
        loading.value = false;
      }
    }

    onMounted(loadRequests);

    async function respond(req, approved) {
      try {
        await api.patch(`/access-requests/${req.id}/respond`, { approved });
        req.status = approved ? 'approved' : 'denied';
        if (approved) req.expiresAt = { seconds: Date.now() / 1000 + (req.expiryDays || 30) * 86400 };
        showToast(approved ? 'Access approved' : 'Request denied');
      } catch (e) {
        showToast(e.message, 'error');
      }
    }

    async function revoke(req) {
      try {
        await api.patch(`/access-requests/${req.id}/revoke`, {});
        req.status = 'revoked';
        showToast('Access revoked');
      } catch (e) {
        showToast(e.message, 'error');
      }
    }

    async function submitRequest() {
      if (!requestForm.patientId) { showToast('Patient ID is required', 'error'); return; }
      if (!requestForm.reason)    { showToast('Reason is required', 'error'); return; }
      submitting.value = true;
      try {
        const { request } = await api.post('/access-requests', {
          patientId:            requestForm.patientId,
          reason:               requestForm.reason,
          accessLevel:          requestForm.accessLevel,
          requestedRecordTypes: requestForm.requestedRecordTypes,
          expiryDays:           Number(requestForm.expiryDays),
        });
        requests.value.unshift(request);
        showRequestModal.value = false;
        Object.assign(requestForm, { patientId: '', reason: '', accessLevel: 'read', requestedRecordTypes: ['lab_report'], expiryDays: 30 });
        showToast('Access request sent to patient');
      } catch (e) {
        showToast(e.message, 'error');
      } finally {
        submitting.value = false;
      }
    }

    function toggleRecordType(t) {
      const idx = requestForm.requestedRecordTypes.indexOf(t);
      if (idx > -1) requestForm.requestedRecordTypes.splice(idx, 1);
      else requestForm.requestedRecordTypes.push(t);
    }

    return {
      requests, loading, activeTab, showRequestModal, submitting, requestForm, RECORD_TYPES,
      isPatient, relativeTime, daysUntil, respond, revoke, submitRequest, toggleRecordType,
    };
  },

  template: `
    <div class="p-6 max-w-4xl mx-auto animate-fade-in">
      <div class="flex items-center justify-between mb-8">
        <div>
          <p class="mono text-ink-500 text-xs mb-1">— Pull Requests</p>
          <h1 class="serif text-3xl text-ink-100">Access Requests</h1>
        </div>
        <button v-if="!isPatient" @click="showRequestModal = true" class="btn-primary flex items-center gap-2">
          <span>⊕</span> Request Access
        </button>
      </div>

      <!-- Tabs (patient only) -->
      <div v-if="isPatient" class="flex gap-1 p-1 bg-ink-900 rounded-lg mb-6 w-fit">
        <button
          v-for="tab in ['incoming','all']"
          :key="tab" @click="activeTab = tab"
          class="px-4 py-1.5 rounded-md text-xs mono transition-all"
          :class="activeTab === tab ? 'bg-ink-700 text-ink-100' : 'text-ink-500 hover:text-ink-300'">
          {{ tab }}
        </button>
      </div>

      <!-- Skeleton -->
      <div v-if="loading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="card p-5 animate-pulse">
          <div class="h-4 w-1/3 bg-ink-800 rounded mb-3"></div>
          <div class="h-3 w-2/3 bg-ink-800 rounded mb-2"></div>
          <div class="h-3 w-1/2 bg-ink-800 rounded"></div>
        </div>
      </div>

      <!-- Empty -->
      <div v-else-if="requests.length === 0" class="card p-12 text-center">
        <div class="text-4xl text-ink-800 mb-3">⊘</div>
        <p class="text-ink-500">No access requests</p>
      </div>

      <!-- Request cards -->
      <div v-else class="space-y-3">
        <div v-for="req in requests" :key="req.id" class="card p-5">
          <div class="flex items-start justify-between gap-4 mb-3">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="font-medium text-ink-100 text-sm">
                  {{ req.doctorName || req.patientName || 'Unknown' }}
                </span>
                <span v-if="req.specialization" class="tag-badge">{{ req.specialization }}</span>
              </div>
              <p class="text-xs text-ink-500 mono">{{ relativeTime(req.requestedAt) }}</p>
            </div>
            <span class="status-badge flex-shrink-0" :class="'status-' + req.status">
              <span>{{ {pending:'○',approved:'●',denied:'×',revoked:'⊗',expired:'◌'}[req.status] || '○' }}</span>
              {{ req.status }}
            </span>
          </div>

          <p class="text-sm text-ink-400 mb-3 leading-relaxed">{{ req.reason }}</p>

          <div class="flex flex-wrap gap-2 mb-3">
            <div class="flex items-center gap-1.5">
              <span class="mono text-xs text-ink-600">Access:</span>
              <span class="mono text-xs text-ink-300">{{ req.accessLevel }}</span>
            </div>
            <span class="text-ink-700">·</span>
            <div class="flex items-center gap-1.5">
              <span class="mono text-xs text-ink-600">Expires:</span>
              <span class="mono text-xs text-ink-300">{{ req.expiryDays }}d</span>
            </div>
            <span v-if="req.expiresAt" class="text-ink-700">·</span>
            <span v-if="req.expiresAt" class="mono text-xs text-sage-500">{{ daysUntil(req.expiresAt) }}</span>
          </div>

          <div class="flex flex-wrap gap-1.5 mb-4">
            <span v-for="t in (req.requestedRecordTypes || [])" :key="t"
              class="tag-badge text-ink-400 border-ink-700 bg-ink-800/50">
              {{ t.replace(/_/g,' ') }}
            </span>
          </div>

          <!-- Patient actions -->
          <div v-if="isPatient && req.status === 'pending'" class="flex gap-2">
            <button @click="respond(req, true)"  class="btn-primary text-xs py-2 px-4">✓ Approve</button>
            <button @click="respond(req, false)" class="btn-danger  text-xs py-2 px-4">× Deny</button>
          </div>
          <div v-if="isPatient && req.status === 'approved'" class="flex gap-2">
            <button @click="revoke(req)" class="btn-danger text-xs py-2 px-4">⊗ Revoke Access</button>
          </div>
        </div>
      </div>

      <!-- New Request Modal (Doctor) -->
      <div v-if="showRequestModal" class="modal-backdrop" @click.self="showRequestModal = false">
        <div class="modal animate-slide-up">
          <div class="flex items-center justify-between mb-6">
            <h2 class="serif text-xl text-ink-100">Request Patient Access</h2>
            <button @click="showRequestModal = false" class="text-ink-600 hover:text-ink-300 text-xl">×</button>
          </div>

          <div class="space-y-4">
            <div>
              <label>Patient UID *</label>
              <input v-model="requestForm.patientId" class="input-field mono text-xs" placeholder="patient-firebase-uid" />
              <p class="mono text-[10px] text-ink-700 mt-1">Ask the patient for their Medilocker UID</p>
            </div>
            <div>
              <label>Clinical Reason *</label>
              <textarea v-model="requestForm.reason" class="input-field" rows="3"
                placeholder="Post-operative follow-up for cardiac surgery..."></textarea>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label>Access Level</label>
                <select v-model="requestForm.accessLevel" class="input-field">
                  <option value="read">Read only</option>
                  <option value="read_write">Read + Write</option>
                </select>
              </div>
              <div>
                <label>Duration (days)</label>
                <input v-model.number="requestForm.expiryDays" type="number" class="input-field" min="1" max="365" />
              </div>
            </div>
            <div>
              <label class="mb-2 block">Record Types Needed</label>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="t in RECORD_TYPES" :key="t"
                  @click="toggleRecordType(t)"
                  class="text-xs mono px-3 py-1.5 rounded-lg border transition-all"
                  :class="requestForm.requestedRecordTypes.includes(t)
                    ? 'bg-sage-900/40 border-sage-700/50 text-sage-300'
                    : 'border-ink-800 text-ink-600 hover:text-ink-400'">
                  {{ t.replace(/_/g,' ') }}
                </button>
              </div>
            </div>
            <div class="flex gap-2 pt-2">
              <button @click="showRequestModal = false" class="btn-ghost flex-1">Cancel</button>
              <button @click="submitRequest" class="btn-primary flex-1" :disabled="submitting">
                <span v-if="submitting" class="mono text-xs">◌ Sending...</span>
                <span v-else>Send Request →</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
});

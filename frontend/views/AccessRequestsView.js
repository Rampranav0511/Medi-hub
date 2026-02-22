// ─── Access Requests View ─────────────────────────────────────────────────────
import api from '../services/api.js';
import { appState, showToast } from '../services/state.js';
import { relativeTime, daysUntil } from '../utils/time.js';

const { ref, reactive, computed, onMounted, defineComponent } = Vue;

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
      accessLevel: 'read', requestedRecordTypes: ['all'], expiryDays: 30,
    });
    const labReportsByRequest = ref({});
    const loadingLabReports = ref({});
    const patientQuery = ref('');
    const patientResults = ref([]);
    const searchingPatients = ref(false);
    const selectedPatient = ref(null);
    const showPrescriptionModal = ref(false);
    const savingPrescription = ref(false);
    const prescriptionTarget = ref(null);
    const prescriptionForm = reactive({
      title: 'Doctor Prescription',
      prescriptionText: '',
      notes: '',
      tags: '',
    });

    async function loadRequests() {
      loading.value = true;
      try {
        const endpoint = isPatient ? '/access-requests/incoming' : '/access-requests/outgoing';
        const { requests: data } = await api.get(endpoint);
        requests.value = data || [];
        if (!isPatient) {
          await Promise.all(
            requests.value
              .filter((r) => r.status === 'approved')
              .map((r) => loadLabReports(r))
          );
        }
      } catch (e) {
        showToast(e.message, 'error');
      } finally {
        loading.value = false;
      }
    }

    onMounted(loadRequests);

    async function searchPatients() {
      const q = patientQuery.value.trim();
      if (selectedPatient.value && q !== (selectedPatient.value.displayName || '')) {
        selectedPatient.value = null;
        requestForm.patientId = '';
      }
      if (q.length < 2) {
        patientResults.value = [];
        return;
      }
      searchingPatients.value = true;
      try {
        const { users } = await api.get(`/auth/patients/search?q=${encodeURIComponent(q)}`);
        patientResults.value = users || [];
      } catch (e) {
        showToast(e.message, 'error');
      } finally {
        searchingPatients.value = false;
      }
    }

    function selectPatient(user) {
      selectedPatient.value = user;
      requestForm.patientId = user.uid;
      patientQuery.value = user.displayName || '';
      patientResults.value = [];
    }

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
        labReportsByRequest.value[req.id] = [];
        showToast('Access revoked');
      } catch (e) {
        showToast(e.message, 'error');
      }
    }

    async function loadLabReports(req) {
      if (!req?.patientId || req.status !== 'approved') return;
      loadingLabReports.value[req.id] = true;
      try {
        const { records } = await api.get(`/patients/${req.patientId}/records`);
        labReportsByRequest.value[req.id] = (records || [])
          .filter((r) => r.recordType === 'lab_report')
          .sort((a, b) => {
            const aSec = a?.updatedAt?.seconds ?? a?.updatedAt?._seconds ?? 0;
            const bSec = b?.updatedAt?.seconds ?? b?.updatedAt?._seconds ?? 0;
            return bSec - aSec;
          });
      } catch (e) {
        labReportsByRequest.value[req.id] = [];
        showToast(e.message, 'error');
      } finally {
        loadingLabReports.value[req.id] = false;
      }
    }

    async function downloadLatest(record) {
      if (!record?.id || !record?.currentVersionId) return;
      try {
        const { downloadUrl } = await api.get(`/records/${record.id}/versions/${record.currentVersionId}/download`);
        window.open(downloadUrl, '_blank');
      } catch (e) {
        showToast(e.message, 'error');
      }
    }

    function openPrescriptionModal(req) {
      prescriptionTarget.value = req;
      prescriptionForm.title = `Prescription - ${req.patientName || req.patientId}`;
      prescriptionForm.prescriptionText = '';
      prescriptionForm.notes = '';
      prescriptionForm.tags = '';
      showPrescriptionModal.value = true;
    }

    async function submitPrescription() {
      if (!prescriptionTarget.value?.patientId) {
        showToast('Patient is required', 'error');
        return;
      }
      if (!prescriptionForm.title.trim()) {
        showToast('Title is required', 'error');
        return;
      }
      if (prescriptionForm.prescriptionText.trim().length < 5) {
        showToast('Prescription text must be at least 5 characters', 'error');
        return;
      }

      savingPrescription.value = true;
      try {
        const tags = prescriptionForm.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);

        await api.post('/records/prescriptions', {
          patientId: prescriptionTarget.value.patientId,
          title: prescriptionForm.title.trim(),
          prescriptionText: prescriptionForm.prescriptionText.trim(),
          notes: prescriptionForm.notes.trim(),
          tags,
        });
        showPrescriptionModal.value = false;
        showToast('Prescription added successfully');
        await loadLabReports(prescriptionTarget.value);
      } catch (e) {
        showToast(e.message, 'error');
      } finally {
        savingPrescription.value = false;
      }
    }

    function selectedRecordTypesForSubmit() {
      const allWithoutFlag = RECORD_TYPES.filter((t) => t !== 'all');
      const picked = requestForm.requestedRecordTypes.filter((t) => t !== 'all');
      if (requestForm.requestedRecordTypes.includes('all') || picked.length === allWithoutFlag.length) {
        return ['all'];
      }
      return picked;
    }

    async function submitRequest() {
      if (!requestForm.patientId.trim()) { showToast('Patient ID is required', 'error'); return; }
      if (!requestForm.reason.trim())    { showToast('Reason is required', 'error'); return; }
      if (requestForm.reason.trim().length < 10) {
        showToast('Reason must be at least 10 characters', 'error');
        return;
      }

      const selectedTypes = selectedRecordTypesForSubmit();
      if (selectedTypes.length === 0) {
        showToast('Select at least one record type', 'error');
        return;
      }

      submitting.value = true;
      try {
        const { request } = await api.post('/access-requests', {
          patientId:            requestForm.patientId.trim(),
          reason:               requestForm.reason.trim(),
          accessLevel:          requestForm.accessLevel,
          requestedRecordTypes: selectedTypes,
          expiryDays:           Number(requestForm.expiryDays),
        });
        requests.value.unshift(request);
        showRequestModal.value = false;
        Object.assign(requestForm, { patientId: '', reason: '', accessLevel: 'read', requestedRecordTypes: ['all'], expiryDays: 30 });
        selectedPatient.value = null;
        patientQuery.value = '';
        patientResults.value = [];
        showToast('Access request sent to patient');
      } catch (e) {
        showToast(e.message, 'error');
      } finally {
        submitting.value = false;
      }
    }

    function toggleRecordType(t) {
      if (t === 'all') {
        if (requestForm.requestedRecordTypes.includes('all')) {
          requestForm.requestedRecordTypes = [];
        } else {
          requestForm.requestedRecordTypes = [...RECORD_TYPES];
        }
        return;
      }

      const idx = requestForm.requestedRecordTypes.indexOf(t);
      if (idx > -1) {
        requestForm.requestedRecordTypes.splice(idx, 1);
      } else {
        requestForm.requestedRecordTypes.push(t);
      }

      const allWithoutFlag = RECORD_TYPES.filter((x) => x !== 'all');
      const hasAllWithoutFlag = allWithoutFlag.every((x) => requestForm.requestedRecordTypes.includes(x));
      if (hasAllWithoutFlag) {
        if (!requestForm.requestedRecordTypes.includes('all')) {
          requestForm.requestedRecordTypes.push('all');
        }
      } else {
        requestForm.requestedRecordTypes = requestForm.requestedRecordTypes.filter((x) => x !== 'all');
      }
    }

    const visibleRequests = computed(() => {
      if (!isPatient) return requests.value;
      if (activeTab.value === 'incoming') {
        return requests.value.filter((r) => r.status === 'pending');
      }
      return requests.value;
    });

    return {
      requests,
      visibleRequests,
      loading,
      activeTab,
      showRequestModal,
      submitting,
      requestForm,
      RECORD_TYPES,
      labReportsByRequest,
      loadingLabReports,
      patientQuery,
      patientResults,
      searchingPatients,
      selectedPatient,
      showPrescriptionModal,
      savingPrescription,
      prescriptionForm,
      prescriptionTarget,
      isPatient,
      relativeTime,
      daysUntil,
      respond,
      revoke,
      submitRequest,
      toggleRecordType,
      searchPatients,
      selectPatient,
      loadLabReports,
      downloadLatest,
      openPrescriptionModal,
      submitPrescription,
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
      <div v-else-if="visibleRequests.length === 0" class="card p-12 text-center">
        <div class="text-4xl text-ink-800 mb-3">⊘</div>
        <p class="text-ink-500">No access requests</p>
      </div>

      <!-- Request cards -->
      <div v-else class="space-y-3">
        <div v-for="req in visibleRequests" :key="req.id" class="card p-5">
          <div class="flex items-start justify-between gap-4 mb-3">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="font-medium text-ink-100 text-sm">
                  {{ isPatient ? (req.doctorName || 'Unknown Doctor') : (req.patientName || req.patientId || 'Unknown Patient') }}
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

          <div v-if="!isPatient && req.status === 'approved'" class="mb-4">
            <div class="flex items-center justify-between mb-2">
              <p class="mono text-xs text-ink-600 uppercase tracking-wider">Lab Reports</p>
              <div class="flex items-center gap-2">
                <button
                  v-if="req.accessLevel === 'read_write'"
                  @click="openPrescriptionModal(req)"
                  class="btn-primary text-[10px] py-1 px-2 mono">
                  + Add Prescription
                </button>
                <button @click="loadLabReports(req)" class="btn-ghost text-[10px] py-1 px-2 mono">
                  ↻ Refresh
                </button>
              </div>
            </div>
            <div v-if="loadingLabReports[req.id]" class="mono text-xs text-ink-600">Loading reports...</div>
            <div v-else-if="(labReportsByRequest[req.id] || []).length === 0" class="mono text-xs text-ink-700">
              No lab reports available for this patient yet.
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="report in labReportsByRequest[req.id]"
                :key="report.id"
                class="rounded-lg border border-ink-800 bg-ink-900/40 p-3 flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-xs text-ink-200 truncate">{{ report.title }}</p>
                  <p class="mono text-[10px] text-ink-600 mt-1">
                    v{{ report.currentVersion }} · {{ relativeTime(report.updatedAt) }}
                    <span v-if="report.currentVersionId"> · latest ready</span>
                  </p>
                </div>
                <button
                  @click="downloadLatest(report)"
                  class="btn-ghost text-[10px] py-1 px-2 mono flex-shrink-0">
                  ↓ Download
                </button>
              </div>
            </div>
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
              <label>Patient Name *</label>
              <input
                v-model="patientQuery"
                @input="searchPatients"
                class="input-field text-xs"
                placeholder="Search by patient name or email" />
              <p class="mono text-[10px] text-ink-700 mt-1">Type at least 2 characters to search patients</p>

              <div v-if="searchingPatients" class="mono text-[10px] text-ink-600 mt-2">
                Searching...
              </div>

              <div v-else-if="patientResults.length > 0" class="mt-2 max-h-36 overflow-auto rounded-lg border border-ink-800">
                <button
                  v-for="u in patientResults"
                  :key="u.uid"
                  type="button"
                  @click="selectPatient(u)"
                  class="w-full text-left px-3 py-2 border-b last:border-b-0 border-ink-800 hover:bg-ink-900/60 transition-colors">
                  <p class="text-xs text-ink-200">{{ u.displayName }}</p>
                  <p class="mono text-[10px] text-ink-600">{{ u.email || u.uid }}</p>
                </button>
              </div>

              <div v-if="selectedPatient" class="mt-2 px-3 py-2 rounded-lg border border-sage-700/40 bg-sage-900/10">
                <p class="text-xs text-sage-300">Selected: {{ selectedPatient.displayName }}</p>
                <p class="mono text-[10px] text-sage-500">{{ selectedPatient.uid }}</p>
              </div>
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
                  type="button"
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

      <!-- Prescription Modal (Doctor) -->
      <div v-if="showPrescriptionModal" class="modal-backdrop" @click.self="showPrescriptionModal = false">
        <div class="modal animate-slide-up">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="serif text-xl text-ink-100">Add Prescription</h2>
              <p class="mono text-xs text-ink-600 mt-1">
                {{ prescriptionTarget?.patientName || prescriptionTarget?.patientId }}
              </p>
            </div>
            <button @click="showPrescriptionModal = false" class="text-ink-600 hover:text-ink-300 text-xl">×</button>
          </div>

          <div class="space-y-4">
            <div>
              <label>Title *</label>
              <input v-model="prescriptionForm.title" class="input-field" placeholder="Doctor Prescription" />
            </div>
            <div>
              <label>Prescription *</label>
              <textarea
                v-model="prescriptionForm.prescriptionText"
                class="input-field"
                rows="5"
                placeholder="Write medication, dosage, and schedule..."></textarea>
            </div>
            <div>
              <label>Health Notes</label>
              <textarea
                v-model="prescriptionForm.notes"
                class="input-field"
                rows="3"
                placeholder="Additional observations or follow-up advice"></textarea>
            </div>
            <div>
              <label>Tags (comma-separated)</label>
              <input v-model="prescriptionForm.tags" class="input-field" placeholder="cardiology, bp, follow-up" />
            </div>
            <div class="flex gap-2 pt-2">
              <button @click="showPrescriptionModal = false" class="btn-ghost flex-1">Cancel</button>
              <button @click="submitPrescription" class="btn-primary flex-1" :disabled="savingPrescription">
                <span v-if="savingPrescription" class="mono text-xs">◌ Saving...</span>
                <span v-else>Save Prescription →</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
});

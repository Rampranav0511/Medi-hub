// ─── Records View (Patient) ───────────────────────────────────────────────────
import api from '../services/api.js';
import { appState, showToast } from '../services/state.js';
import { relativeTime, formatBytes } from '../utils/time.js';

const { ref, reactive, onMounted, defineComponent } = Vue;

const RECORD_TYPES = ['prescription','lab_report','xray','discharge_summary','vaccination','imaging','other'];

const TYPE_ICONS = {
  prescription: '℞', lab_report: '⊞', xray: '◫',
  discharge_summary: '⊡', vaccination: '⊕', imaging: '◈', other: '◌',
};

export const RecordsView = defineComponent({
  name: 'RecordsView',
  setup() {
    const records          = ref([]);
    const loading          = ref(true);
    const showUploadModal  = ref(false);
    const showVersionModal = ref(false);
    const uploading        = ref(false);
    const loadingVersions  = ref(false);
    const selectedRecord   = ref(null);
    const versions         = ref([]);
    const dragOver         = ref(false);
    const fileInput        = ref(null);

    const uploadForm = reactive({
      file: null, fileName: '', title: '',
      recordType: 'lab_report', issuedDate: '', issuedBy: '',
      tags: '', commitMessage: '',
    });

    async function loadRecords() {
      loading.value = true;
      try {
        const { records: data } = await api.get(`/patients/${appState.user.uid}/records`);
        records.value = data || [];
      } catch (e) {
        showToast(e.message, 'error');
      } finally {
        loading.value = false;
      }
    }

    onMounted(loadRecords);

    async function viewVersions(record) {
      selectedRecord.value   = record;
      showVersionModal.value = true;
      loadingVersions.value  = true;
      versions.value         = [];
      try {
        const { versions: data } = await api.get(`/records/${record.id}/versions`);
        versions.value = data || [];
      } catch (e) {
        showToast(e.message, 'error');
      } finally {
        loadingVersions.value = false;
      }
    }

    async function downloadVersion(recordId, versionId) {
      try {
        const { downloadUrl } = await api.get(`/records/${recordId}/versions/${versionId}/download`);
        window.open(downloadUrl, '_blank');
      } catch (e) {
        showToast(e.message, 'error');
      }
    }

    function handleFileChange(e) {
      const f = e.target.files[0];
      if (f) { uploadForm.file = f; uploadForm.fileName = f.name; }
    }

    function handleDrop(e) {
      dragOver.value = false;
      const f = e.dataTransfer.files[0];
      if (f) { uploadForm.file = f; uploadForm.fileName = f.name; }
    }

    async function submitUpload() {
      if (!uploadForm.file)          { showToast('Please select a file', 'error'); return; }
      if (!uploadForm.title)         { showToast('Title is required', 'error'); return; }
      if (!uploadForm.commitMessage) { showToast('Commit message is required', 'error'); return; }

      uploading.value = true;
      try {
        const fd = new FormData();
        fd.append('file',          uploadForm.file);
        fd.append('title',         uploadForm.title);
        fd.append('recordType',    uploadForm.recordType);
        fd.append('commitMessage', uploadForm.commitMessage);
        fd.append('issuedBy',      uploadForm.issuedBy);
        fd.append('issuedDate',    uploadForm.issuedDate);
        if (uploadForm.tags) {
          uploadForm.tags.split(',').map(t => t.trim()).filter(Boolean)
            .forEach(t => fd.append('tags[]', t));
        }

        const { record } = await api.postFile('/records', fd);
        records.value.unshift(record);
        showUploadModal.value = false;
        Object.assign(uploadForm, {
          file: null, fileName: '', title: '', recordType: 'lab_report',
          issuedDate: '', issuedBy: '', tags: '', commitMessage: '',
        });
        showToast('Record uploaded successfully');
      } catch (e) {
        showToast(e.message, 'error');
      } finally {
        uploading.value = false;
      }
    }

    async function deleteRecord(record) {
      if (!confirm(`Delete "${record.title}"? This cannot be undone.`)) return;
      try {
        await api.delete(`/records/${record.id}`);
        records.value = records.value.filter(r => r.id !== record.id);
        showToast('Record deleted');
      } catch (e) {
        showToast(e.message, 'error');
      }
    }

    return {
      records, loading, showUploadModal, showVersionModal, uploading,
      loadingVersions, selectedRecord, versions, dragOver, fileInput, uploadForm,
      RECORD_TYPES, TYPE_ICONS,
      viewVersions, downloadVersion, handleFileChange, handleDrop, submitUpload,
      deleteRecord, relativeTime, formatBytes,
    };
  },

  template: `
    <div class="p-6 max-w-4xl mx-auto animate-fade-in">
      <div class="flex items-center justify-between mb-8">
        <div>
          <p class="mono text-ink-500 text-xs mb-1">— Repository</p>
          <h1 class="serif text-3xl text-ink-100">My Records</h1>
          <p class="text-sm text-ink-500 mt-1">{{ records.length }} record{{ records.length !== 1 ? 's' : '' }}</p>
        </div>
        <button @click="showUploadModal = true" class="btn-primary flex items-center gap-2">
          <span>⊕</span> Upload Record
        </button>
      </div>

      <!-- Loading skeleton -->
      <div v-if="loading" class="space-y-3">
        <div v-for="i in 4" :key="i" class="card p-5 animate-pulse">
          <div class="flex gap-4">
            <div class="w-10 h-10 rounded-lg bg-ink-800 flex-shrink-0"></div>
            <div class="flex-1">
              <div class="h-4 w-1/3 bg-ink-800 rounded mb-2"></div>
              <div class="h-3 w-1/2 bg-ink-800 rounded mb-3"></div>
              <div class="flex gap-2">
                <div class="h-5 w-16 bg-ink-800 rounded-full"></div>
                <div class="h-5 w-20 bg-ink-800 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="records.length === 0" class="card p-16 text-center">
        <div class="text-5xl mb-4 text-ink-800">⊕</div>
        <p class="serif text-xl text-ink-500 mb-2">No records yet</p>
        <p class="text-sm text-ink-600 mb-6">Upload your first medical record to get started</p>
        <button @click="showUploadModal = true" class="btn-primary">Upload Record →</button>
      </div>

      <!-- Records list -->
      <div v-else class="space-y-3">
        <div v-for="record in records" :key="record.id"
          class="card p-5 hover:border-ink-700/60 transition-all group">
          <div class="flex items-start gap-4">
            <div class="w-10 h-10 rounded-lg bg-ink-800 border border-ink-700 flex items-center justify-center text-lg flex-shrink-0">
              {{ TYPE_ICONS[record.recordType] || '◌' }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h3 class="text-sm font-medium text-ink-100 group-hover:text-sage-300 transition-colors">
                    {{ record.title }}
                  </h3>
                  <p class="mono text-xs text-ink-600 mt-0.5">
                    {{ record.recordType.replace(/_/g,' ') }}
                    <span v-if="record.issuedBy"> · {{ record.issuedBy }}</span>
                    <span v-if="record.issuedDate"> · {{ record.issuedDate }}</span>
                  </p>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <span class="mono text-xs text-ink-600">
                    v{{ record.currentVersion }} · {{ relativeTime(record.updatedAt) }}
                  </span>
                </div>
              </div>

              <div class="flex flex-wrap gap-1.5 mt-2">
                <span v-for="tag in (record.tags || [])" :key="tag" class="tag-badge">{{ tag }}</span>
              </div>

              <div class="flex items-center gap-2 mt-3">
                <button @click="viewVersions(record)" class="btn-ghost text-xs py-1.5 px-3 mono">
                  ⊞ {{ record.currentVersion }} version{{ record.currentVersion !== 1 ? 's' : '' }}
                </button>
                <button @click="deleteRecord(record)" class="btn-danger text-xs py-1.5 px-3">
                  ⊗ Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Upload Modal -->
      <div v-if="showUploadModal" class="modal-backdrop" @click.self="showUploadModal = false">
        <div class="modal animate-slide-up">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="serif text-xl text-ink-100">Commit New Record</h2>
              <p class="mono text-xs text-ink-500 mt-0.5">Upload a medical file to your repository</p>
            </div>
            <button @click="showUploadModal = false" class="text-ink-600 hover:text-ink-300 text-xl">×</button>
          </div>

          <div class="space-y-4">
            <!-- File drop zone -->
            <div
              class="file-drop"
              :class="{ 'drag-over': dragOver }"
              @dragover.prevent="dragOver = true"
              @dragleave="dragOver = false"
              @drop.prevent="handleDrop"
              @click="fileInput.click()">
              <input ref="fileInput" type="file" class="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.dcm"
                @change="handleFileChange" />
              <div v-if="uploadForm.fileName">
                <div class="text-sage-400 text-2xl mb-2">◈</div>
                <p class="text-sm text-sage-400 mono">{{ uploadForm.fileName }}</p>
              </div>
              <div v-else>
                <div class="text-ink-600 text-2xl mb-2">⊕</div>
                <p class="text-sm text-ink-500">Drop file here or click to browse</p>
                <p class="text-xs text-ink-700 mt-1 mono">PDF, JPEG, PNG, DICOM · Max 20MB</p>
              </div>
            </div>

            <div>
              <label>Title *</label>
              <input v-model="uploadForm.title" class="input-field" placeholder="Blood Test Report Q1 2025" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label>Record Type</label>
                <select v-model="uploadForm.recordType" class="input-field">
                  <option v-for="t in RECORD_TYPES" :key="t" :value="t">{{ t.replace(/_/g,' ') }}</option>
                </select>
              </div>
              <div>
                <label>Issued Date</label>
                <input v-model="uploadForm.issuedDate" type="date" class="input-field" />
              </div>
            </div>

            <div>
              <label>Issued By</label>
              <input v-model="uploadForm.issuedBy" class="input-field" placeholder="Apollo Diagnostics" />
            </div>

            <div>
              <label>Tags (comma-separated)</label>
              <input v-model="uploadForm.tags" class="input-field" placeholder="diabetes, HbA1c, glucose" />
            </div>

            <div>
              <label>Commit Message *</label>
              <input v-model="uploadForm.commitMessage" class="input-field mono text-xs"
                placeholder="Initial upload — baseline CBC before medication" />
            </div>

            <div class="flex gap-2 pt-2">
              <button @click="showUploadModal = false" class="btn-ghost flex-1">Cancel</button>
              <button @click="submitUpload" class="btn-primary flex-1" :disabled="uploading">
                <span v-if="uploading" class="mono text-xs">◌ Uploading...</span>
                <span v-else>Commit Record →</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Version History Modal -->
      <div v-if="showVersionModal" class="modal-backdrop" @click.self="showVersionModal = false">
        <div class="modal animate-slide-up" style="max-width: 580px">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="serif text-xl text-ink-100">Version History</h2>
              <p class="mono text-xs text-ink-500 mt-0.5 truncate max-w-xs">{{ selectedRecord?.title }}</p>
            </div>
            <button @click="showVersionModal = false" class="text-ink-600 hover:text-ink-300 text-xl">×</button>
          </div>

          <div v-if="loadingVersions" class="space-y-4">
            <div v-for="i in 3" :key="i" class="flex gap-3 animate-pulse">
              <div class="w-2 h-2 rounded-full bg-ink-800 mt-2 flex-shrink-0"></div>
              <div class="flex-1">
                <div class="h-3 w-3/4 bg-ink-800 rounded mb-2"></div>
                <div class="h-2 w-1/3 bg-ink-800 rounded"></div>
              </div>
            </div>
          </div>

          <div v-else-if="versions.length === 0" class="text-center py-8 text-ink-600">No versions found</div>

          <div v-else class="space-y-0 relative">
            <div class="absolute left-[3px] top-2 bottom-2 w-px bg-ink-800"></div>
            <div v-for="(ver, idx) in versions" :key="ver.id" class="flex gap-4 pb-5 relative">
              <div class="timeline-dot flex-shrink-0" :class="idx === 0 ? 'bg-sage-500' : 'bg-ink-700'"></div>
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <p class="mono text-xs text-ink-600 mb-0.5">
                      v{{ ver.versionNumber }} · {{ ver.committedBy }}
                      <span class="text-ink-700">({{ ver.committedByRole }})</span>
                    </p>
                    <p class="text-sm text-ink-200 font-medium">{{ ver.commitMessage }}</p>
                    <div class="flex items-center gap-3 mt-1">
                      <span class="mono text-xs text-ink-600">{{ ver.fileName }}</span>
                      <span class="mono text-xs text-ink-700">{{ formatBytes(ver.fileSize) }}</span>
                      <span class="mono text-xs text-ink-700">{{ relativeTime(ver.createdAt) }}</span>
                    </div>
                  </div>
                  <button
                    @click="downloadVersion(selectedRecord.id, ver.id)"
                    class="btn-ghost text-xs py-1 px-2 flex-shrink-0 mono">
                    ↓ Download
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
});

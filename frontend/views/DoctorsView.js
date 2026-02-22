// ─── Doctors Discovery View ───────────────────────────────────────────────────
import api from '../services/api.js';
import { appState, showToast } from '../services/state.js';
import { relativeTime } from '../utils/time.js';
import { getContribColor, buildContribWeeks } from '../utils/contrib.js';
import { ContribGraph } from '../components/ContribGraph.js';

const { ref, reactive, computed, onMounted } = Vue;

export const DoctorsView = {
  components: { ContribGraph },

  setup() {
    const doctors           = ref([]);
    const loading           = ref(true);
    const selectedDoctor    = ref(null);
    const showProfile       = ref(false);
    const showEndorseModal  = ref(false);
    const submittingEndorse = ref(false);
    const loadingProfile    = ref(false);

    const filters = reactive({
      specialization: '', sortBy: 'totalCasesHandled',
      minCases: '', conditionTag: '',
    });

    const endorseForm = reactive({ skill: '', note: '' });

    async function loadDoctors() {
      loading.value = true;
      try {
        const params = new URLSearchParams();
        if (filters.specialization) params.set('specialization', filters.specialization);
        if (filters.sortBy)         params.set('sortBy', filters.sortBy);
        if (filters.minCases)       params.set('minCases', filters.minCases);
        if (filters.conditionTag)   params.set('conditionTag', filters.conditionTag);

        const { doctors: data } = await api.get(`/doctors?${params.toString()}`);
        doctors.value = data || [];
      } catch (e) {
        showToast(e.message, 'error');
      } finally {
        loading.value = false;
      }
    }

    onMounted(loadDoctors);

    const specializations = computed(() => {
      const s = new Set(doctors.value.map(d => d.specialization).filter(Boolean));
      return [...s].sort();
    });

    const filteredDoctors = computed(() => {
      return doctors.value.filter(d => {
        if (filters.specialization && d.specialization !== filters.specialization) return false;
        if (filters.minCases && (d.stats?.totalCasesHandled ?? 0) < parseInt(filters.minCases)) return false;
        if (filters.conditionTag && !(d.conditionTags || []).includes(filters.conditionTag)) return false;
        return true;
      }).sort((a, b) => {
        const key = filters.sortBy;
        if (key === 'averageResponseTimeHours') return (a.stats?.[key] ?? 0) - (b.stats?.[key] ?? 0);
        return (b.stats?.[key] ?? 0) - (a.stats?.[key] ?? 0);
      });
    });

    // Open doctor profile — fetches full details + REAL contribution graph from DB
    async function openProfile(doc) {
      selectedDoctor.value = doc;
      showProfile.value    = true;
      loadingProfile.value = true;
      try {
        const [profileRes, graphRes] = await Promise.all([
          api.get(`/doctors/${doc.uid}`),
          api.get(`/doctors/${doc.uid}/contribution-graph`),
        ]);
        // Merge real graph data into selected doctor
        selectedDoctor.value = {
          ...profileRes.doctor,
          _graphData:    graphRes.contributionGraph || {},   // flat { "YYYY-MM-DD": count }
          _graphSummary: graphRes.summary || {},
        };
      } catch (e) {
        showToast(e.message, 'error');
      } finally {
        loadingProfile.value = false;
      }
    }

    async function submitEndorse() {
      if (!endorseForm.skill) { showToast('Skill is required', 'error'); return; }
      submittingEndorse.value = true;
      try {
        await api.post(`/doctors/${selectedDoctor.value.uid}/endorse`, {
          skill: endorseForm.skill,
          note:  endorseForm.note,
        });
        showEndorseModal.value = false;
        endorseForm.skill = '';
        endorseForm.note  = '';
        showToast(`Endorsed for "${endorseForm.skill || 'skill'}"`);
      } catch (e) {
        showToast(e.message, 'error');
      } finally {
        submittingEndorse.value = false;
      }
    }

    function lastActive(ts) {
      if (!ts) return 'Unknown';
      return relativeTime(ts);
    }

    return {
      doctors, filteredDoctors, loading, filters, specializations,
      selectedDoctor, showProfile, showEndorseModal, endorseForm, submittingEndorse,
      loadingProfile, getContribColor, buildContribWeeks,
      openProfile, submitEndorse, lastActive, appState,
    };
  },

  template: `
    <div class="p-6 max-w-5xl mx-auto animate-fade-in">
      <div class="mb-8">
        <p class="mono text-ink-500 text-xs mb-1">— Discovery</p>
        <h1 class="serif text-3xl text-ink-100 mb-1">Find Doctors</h1>
        <p class="text-sm text-ink-500">Ranked by real contribution data. No ratings. No paid placements.</p>
      </div>

      <!-- Filters -->
      <div class="card p-4 mb-6">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label>Specialization</label>
            <select v-model="filters.specialization" class="input-field text-xs">
              <option value="">All</option>
              <option v-for="s in specializations" :key="s">{{ s }}</option>
            </select>
          </div>
          <div>
            <label>Sort By</label>
            <select v-model="filters.sortBy" class="input-field text-xs">
              <option value="totalCasesHandled">Total Cases</option>
              <option value="recordAccuracyScore">Accuracy Score</option>
              <option value="averageResponseTimeHours">Response Time</option>
            </select>
          </div>
          <div>
            <label>Min Cases</label>
            <input v-model="filters.minCases" type="number" class="input-field text-xs" placeholder="0" />
          </div>
          <div>
            <label>Condition Tag</label>
            <input v-model="filters.conditionTag" class="input-field text-xs" placeholder="hypertension" />
          </div>
        </div>
      </div>

      <!-- Skeleton -->
      <div v-if="loading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="card p-5 animate-pulse">
          <div class="flex gap-4">
            <div class="w-12 h-12 rounded-full bg-ink-800"></div>
            <div class="flex-1">
              <div class="h-4 w-1/3 bg-ink-800 rounded mb-2"></div>
              <div class="h-3 w-1/4 bg-ink-800 rounded mb-3"></div>
              <div class="grid grid-cols-4 gap-2">
                <div v-for="j in 4" :key="j" class="h-10 bg-ink-800 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Doctor cards -->
      <div v-else-if="filteredDoctors.length === 0" class="card p-12 text-center">
        <div class="text-4xl text-ink-800 mb-3">⊙</div>
        <p class="text-ink-500">No doctors found matching filters</p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="doc in filteredDoctors" :key="doc.uid"
          class="card p-5 cursor-pointer group hover:-translate-y-0.5 transition-all"
          @click="openProfile(doc)">
          <div class="flex items-start gap-4">
            <div class="w-11 h-11 rounded-full bg-sage-900/50 border border-sage-700/30 flex items-center justify-center text-sage-400 text-lg font-serif flex-shrink-0">
              {{ (doc.displayName || '?')[0] }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h3 class="text-sm font-medium text-ink-100 group-hover:text-sage-300 transition-colors">
                    {{ doc.displayName }}
                  </h3>
                  <p class="mono text-xs text-ink-500 mt-0.5">
                    {{ doc.specialization }} · {{ doc.yearsOfExperience }}yr exp
                  </p>
                  <p class="mono text-xs text-ink-700 mt-0.5">
                    Last active: {{ lastActive(doc.stats?.lastActiveAt) }}
                  </p>
                </div>
                <span class="text-xs mono text-ink-600">→</span>
              </div>

              <div class="grid grid-cols-4 gap-2 mt-3">
                <div class="text-center p-2 rounded-lg bg-ink-800/50">
                  <div class="mono text-sm font-medium text-ink-200">{{ doc.stats?.totalCasesHandled ?? 0 }}</div>
                  <div class="mono text-[10px] text-ink-600">cases</div>
                </div>
                <div class="text-center p-2 rounded-lg bg-ink-800/50">
                  <div class="mono text-sm font-medium text-sage-400">{{ doc.stats?.activeCases ?? 0 }}</div>
                  <div class="mono text-[10px] text-ink-600">active</div>
                </div>
                <div class="text-center p-2 rounded-lg bg-ink-800/50">
                  <div class="mono text-sm font-medium text-ink-200">{{ doc.stats?.averageResponseTimeHours ?? 0 }}h</div>
                  <div class="mono text-[10px] text-ink-600">response</div>
                </div>
                <div class="text-center p-2 rounded-lg bg-ink-800/50">
                  <div class="mono text-sm font-medium text-sage-400">{{ doc.stats?.recordAccuracyScore ?? 0 }}</div>
                  <div class="mono text-[10px] text-ink-600">accuracy</div>
                </div>
              </div>

              <div class="flex flex-wrap gap-1 mt-3">
                <span v-for="tag in (doc.conditionTags || []).slice(0,4)" :key="tag" class="tag-badge">{{ tag }}</span>
                <span v-if="(doc.conditionTags || []).length > 4" class="tag-badge text-ink-600">
                  +{{ doc.conditionTags.length - 4 }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Doctor Profile Modal -->
      <div v-if="showProfile && selectedDoctor" class="modal-backdrop" @click.self="showProfile = false">
        <div class="modal animate-slide-up" style="max-width: 640px">
          <!-- Header -->
          <div class="flex items-start justify-between mb-6">
            <div class="flex gap-3">
              <div class="w-14 h-14 rounded-full bg-sage-900/50 border border-sage-700/30 flex items-center justify-center text-sage-400 text-2xl font-serif">
                {{ (selectedDoctor.displayName || '?')[0] }}
              </div>
              <div>
                <h2 class="serif text-2xl text-ink-100">{{ selectedDoctor.displayName }}</h2>
                <p class="mono text-xs text-ink-500">{{ selectedDoctor.specialization }}</p>
                <div class="flex flex-wrap gap-1 mt-1">
                  <span v-for="q in (selectedDoctor.qualifications || [])" :key="q"
                    class="mono text-xs text-ink-600">{{ q }}</span>
                </div>
              </div>
            </div>
            <button @click="showProfile = false" class="text-ink-600 hover:text-ink-300 text-xl flex-shrink-0">×</button>
          </div>

          <div v-if="loadingProfile" class="space-y-4 animate-pulse">
            <div class="grid grid-cols-4 gap-2">
              <div v-for="i in 4" :key="i" class="h-16 bg-ink-800 rounded-lg"></div>
            </div>
            <div class="h-24 bg-ink-800 rounded-lg"></div>
          </div>

          <template v-else>
            <!-- Stats -->
            <div class="grid grid-cols-4 gap-2 mb-6">
              <div class="stat-card text-center">
                <div class="mono text-xl text-ink-100 font-medium">{{ selectedDoctor.stats?.totalCasesHandled ?? 0 }}</div>
                <div class="mono text-[10px] text-ink-600">Total Cases</div>
              </div>
              <div class="stat-card text-center">
                <div class="mono text-xl text-sage-400 font-medium">{{ selectedDoctor.stats?.activeCases ?? 0 }}</div>
                <div class="mono text-[10px] text-ink-600">Active</div>
              </div>
              <div class="stat-card text-center">
                <div class="mono text-xl text-ink-100 font-medium">{{ selectedDoctor.stats?.averageResponseTimeHours ?? 0 }}h</div>
                <div class="mono text-[10px] text-ink-600">Response</div>
              </div>
              <div class="stat-card text-center">
                <div class="mono text-xl text-sage-400 font-medium">{{ selectedDoctor.stats?.recordAccuracyScore ?? 0 }}</div>
                <div class="mono text-[10px] text-ink-600">Accuracy</div>
              </div>
            </div>

            <!-- REAL Contribution Graph from DB -->
            <div class="mb-6">
              <p class="mono text-xs text-ink-600 mb-2 uppercase tracking-wider">
                Contribution Activity
                <span v-if="selectedDoctor._graphSummary?.totalContributions" class="text-ink-700">
                  · {{ selectedDoctor._graphSummary.totalContributions }} total
                </span>
              </p>
              <ContribGraph :graph-data="selectedDoctor._graphData || {}" />
            </div>

            <!-- Endorsements -->
            <div class="mb-6" v-if="Object.keys(selectedDoctor.endorsementCounts || {}).length > 0">
              <p class="mono text-xs text-ink-600 mb-2 uppercase tracking-wider">Peer Endorsements</p>
              <div class="flex flex-wrap gap-2">
                <div
                  v-for="(count, skill) in selectedDoctor.endorsementCounts" :key="skill"
                  class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ink-800/50 border border-ink-700">
                  <span class="text-sage-400 mono text-xs font-medium">{{ count }}</span>
                  <span class="text-ink-300 text-xs">{{ skill }}</span>
                </div>
              </div>
            </div>

            <!-- Hospital affiliations -->
            <div class="mb-6" v-if="(selectedDoctor.hospitalAffiliations || []).length > 0">
              <p class="mono text-xs text-ink-600 mb-2 uppercase tracking-wider">Hospital Affiliations</p>
              <div class="flex flex-wrap gap-2">
                <span v-for="h in selectedDoctor.hospitalAffiliations" :key="h"
                  class="mono text-xs px-3 py-1 rounded-lg border border-ink-700 text-ink-400">{{ h }}</span>
              </div>
            </div>

            <!-- Condition Tags -->
            <div class="mb-6" v-if="(selectedDoctor.conditionTags || []).length > 0">
              <p class="mono text-xs text-ink-600 mb-2 uppercase tracking-wider">Condition Specializations</p>
              <div class="flex flex-wrap gap-1">
                <span v-for="tag in selectedDoctor.conditionTags" :key="tag" class="tag-badge">{{ tag }}</span>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-2">
              <button
                v-if="appState.user?.role === 'doctor' && appState.user?.uid !== selectedDoctor.uid"
                @click="showEndorseModal = true; showProfile = false"
                class="btn-primary flex-1">
                ★ Endorse
              </button>
              <button @click="showProfile = false" class="btn-ghost flex-1">Close</button>
            </div>
          </template>
        </div>
      </div>

      <!-- Endorse Modal -->
      <div v-if="showEndorseModal" class="modal-backdrop" @click.self="showEndorseModal = false">
        <div class="modal animate-slide-up" style="max-width: 420px">
          <div class="flex items-center justify-between mb-6">
            <h2 class="serif text-xl text-ink-100">Endorse Colleague</h2>
            <button @click="showEndorseModal = false" class="text-ink-600 hover:text-ink-300 text-xl">×</button>
          </div>
          <div class="space-y-4">
            <div>
              <label>Skill / Competency *</label>
              <input v-model="endorseForm.skill" class="input-field"
                placeholder="ECG interpretation, cardiac surgery..." />
            </div>
            <div>
              <label>Note (optional)</label>
              <textarea v-model="endorseForm.note" class="input-field" rows="2"
                placeholder="Exceptional skill in..."></textarea>
            </div>
            <div class="flex gap-2">
              <button @click="showEndorseModal = false" class="btn-ghost flex-1">Cancel</button>
              <button @click="submitEndorse" class="btn-primary flex-1" :disabled="submittingEndorse">
                <span v-if="submittingEndorse">◌ Submitting...</span>
                <span v-else>★ Endorse →</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
};

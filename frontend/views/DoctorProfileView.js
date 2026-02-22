// ─── Doctor Profile View ──────────────────────────────────────────────────────
// Shows the logged-in doctor's own profile with real contribution graph from DB
import api from '../services/api.js';
import { appState, showToast } from '../services/state.js';
import { ContribGraph } from '../components/ContribGraph.js';

const { ref, onMounted } = Vue;

export const DoctorProfileView = {
  components: { ContribGraph },

  setup() {
    const profile      = ref(null);
    const loading      = ref(true);
    const graphData    = ref({});
    const graphSummary = ref({});

    onMounted(async () => {
      try {
        const [profileRes, graphRes] = await Promise.all([
          api.get(`/doctors/${appState.user.uid}`),
          api.get(`/doctors/${appState.user.uid}/contribution-graph`),
        ]);
        profile.value      = profileRes.doctor;
        graphData.value    = graphRes.contributionGraph || {};
        graphSummary.value = graphRes.summary || {};
      } catch (e) {
        showToast(e.message, 'error');
      } finally {
        loading.value = false;
      }
    });

    return { profile, loading, graphData, graphSummary, appState };
  },

  template: `
    <div class="p-6 max-w-4xl mx-auto animate-fade-in">
      <div class="mb-8">
        <p class="mono text-ink-500 text-xs mb-1">— Profile</p>
        <h1 class="serif text-3xl text-ink-100">My Contribution Profile</h1>
        <p class="text-sm text-ink-500 mt-1">Your GitHub-style medical contribution record</p>
      </div>

      <!-- Skeleton -->
      <div v-if="loading" class="animate-pulse space-y-4">
        <div class="card p-6">
          <div class="flex gap-4">
            <div class="w-16 h-16 rounded-full bg-ink-800"></div>
            <div class="flex-1">
              <div class="h-5 w-1/3 bg-ink-800 rounded mb-2"></div>
              <div class="h-3 w-1/4 bg-ink-800 rounded"></div>
            </div>
          </div>
        </div>
        <div class="grid grid-cols-5 gap-3">
          <div v-for="i in 5" :key="i" class="stat-card h-20"></div>
        </div>
        <div class="card p-5 h-36"></div>
      </div>

      <div v-else-if="profile">
        <!-- Profile header -->
        <div class="card p-6 mb-4">
          <div class="flex items-start gap-4">
            <div class="w-16 h-16 rounded-full bg-sage-900/50 border border-sage-700/30 flex items-center justify-center text-sage-400 text-3xl font-serif">
              {{ (profile.displayName || '?')[0] }}
            </div>
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <h2 class="serif text-2xl text-ink-100">{{ profile.displayName }}</h2>
                <span v-if="profile.isVerified" class="tag-badge">✓ Verified</span>
              </div>
              <p class="text-ink-500 text-sm">
                {{ profile.specialization }} · {{ profile.yearsOfExperience }} years experience
              </p>
              <div class="flex flex-wrap gap-1.5 mt-2">
                <span v-for="q in (profile.qualifications || [])" :key="q"
                  class="mono text-xs px-2 py-0.5 rounded border border-ink-700 text-ink-500">{{ q }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-3 md:grid-cols-5 gap-3 mb-4">
          <div class="stat-card text-center">
            <div class="mono text-2xl text-ink-100 font-medium">{{ profile.stats?.totalCasesHandled ?? 0 }}</div>
            <div class="mono text-[10px] text-ink-600 mt-0.5">Total Cases</div>
          </div>
          <div class="stat-card text-center">
            <div class="mono text-2xl text-sage-400 font-medium">{{ profile.stats?.activeCases ?? 0 }}</div>
            <div class="mono text-[10px] text-ink-600 mt-0.5">Active</div>
          </div>
          <div class="stat-card text-center">
            <div class="mono text-2xl text-ink-100 font-medium">{{ profile.stats?.averageResponseTimeHours ?? 0 }}h</div>
            <div class="mono text-[10px] text-ink-600 mt-0.5">Avg Response</div>
          </div>
          <div class="stat-card text-center">
            <div class="mono text-2xl text-sage-400 font-medium">{{ profile.stats?.recordAccuracyScore ?? 0 }}</div>
            <div class="mono text-[10px] text-ink-600 mt-0.5">Accuracy</div>
          </div>
          <div class="stat-card text-center">
            <div class="mono text-2xl text-ink-100 font-medium">{{ profile.stats?.totalRecordsUpdated ?? 0 }}</div>
            <div class="mono text-[10px] text-ink-600 mt-0.5">Record Commits</div>
          </div>
        </div>

        <!-- REAL Contribution Graph from DB -->
        <div class="card p-5 mb-4">
          <div class="flex items-center justify-between mb-3">
            <p class="mono text-xs text-ink-600 uppercase tracking-wider">
              Contribution Graph — Last 26 Weeks
            </p>
            <div class="flex gap-4 mono text-xs text-ink-700">
              <span v-if="graphSummary.totalContributions">
                {{ graphSummary.totalContributions }} total
              </span>
              <span v-if="graphSummary.currentStreak">
                🔥 {{ graphSummary.currentStreak }}d streak
              </span>
            </div>
          </div>
          <ContribGraph :graph-data="graphData" />
        </div>

        <!-- Endorsements -->
        <div class="card p-5 mb-4" v-if="Object.keys(profile.endorsementCounts || {}).length > 0">
          <p class="mono text-xs text-ink-600 uppercase tracking-wider mb-3">Peer Endorsements</p>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="(count, skill) in profile.endorsementCounts" :key="skill"
              class="flex items-center gap-2 px-3 py-2 rounded-lg bg-ink-800/50 border border-ink-700">
              <span class="text-sage-400 mono text-sm font-medium">{{ count }}</span>
              <span class="text-ink-300 text-sm">{{ skill }}</span>
            </div>
          </div>
        </div>

        <!-- Condition Tags -->
        <div class="card p-5" v-if="(profile.conditionTags || []).length > 0">
          <p class="mono text-xs text-ink-600 uppercase tracking-wider mb-3">Condition Specializations</p>
          <div class="flex flex-wrap gap-1.5">
            <span v-for="tag in profile.conditionTags" :key="tag" class="tag-badge">{{ tag }}</span>
          </div>
          <p class="mono text-xs text-ink-700 mt-3">Derived from real case history — not self-reported</p>
        </div>
      </div>

      <div v-else class="card p-12 text-center">
        <div class="text-4xl text-ink-800 mb-3">◎</div>
        <p class="text-ink-500">Profile not found</p>
        <p class="mono text-xs text-ink-700 mt-1">Contact support if this persists</p>
      </div>
    </div>
  `,
};

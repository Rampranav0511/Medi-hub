// ─── Login / Register View ────────────────────────────────────────────────────
import api from '../services/api.js';
import { appState, setAuth, showToast } from '../services/state.js';

const { ref, reactive } = Vue;
const { useRouter } = VueRouter;

export const LoginView = {
  setup() {
    const router  = useRouter();
    const mode    = ref('login');
    const role    = ref('patient');
    const loading = ref(false);
    const error   = ref('');

    const form = reactive({
      email: '', password: '', displayName: '',
      dateOfBirth: '', gender: 'male', bloodGroup: '',
      specialization: '', licenseNumber: '',
      qualifications: '', yearsOfExperience: 0,
    });

    async function handleSubmit() {
      loading.value = true;
      error.value   = '';
      try {
        let token;
        let firebaseUser = null;

        if (window._firebaseAuth && window._firebaseSignIn) {
          // ── Real Firebase path ─────────────────────────────────────────────
          let cred;
          if (mode.value === 'login') {
            cred = await window._firebaseSignIn(
              window._firebaseAuth, form.email, form.password
            );
          } else {
            cred = await window._firebaseSignUp(
              window._firebaseAuth, form.email, form.password
            );
          }
          firebaseUser = cred.user;
          token = await firebaseUser.getIdToken();
        } else {
          // ── Demo path (no Firebase SDK) ────────────────────────────────────
          // Falls back to direct username/password login via backend.
          // Remove this block once Firebase is configured.
          const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: form.email, password: form.password }),
          });
          const loginJson = await loginRes.json();
          if (!loginRes.ok) throw new Error(loginJson.error || 'Login failed');
          token = loginJson.token;
        }

        // ── Register profile on backend (sign-up only) ─────────────────────
        if (mode.value === 'register') {
          const endpoint = role.value === 'patient'
            ? '/auth/register/patient'
            : '/auth/register/doctor';

          const body = role.value === 'patient'
            ? {
                displayName:  form.displayName,
                dateOfBirth:  form.dateOfBirth,
                gender:       form.gender,
                bloodGroup:   form.bloodGroup,
              }
            : {
                displayName:        form.displayName,
                specialization:     form.specialization,
                licenseNumber:      form.licenseNumber,
                qualifications:     form.qualifications.split(',').map(q => q.trim()).filter(Boolean),
                yearsOfExperience:  Number(form.yearsOfExperience),
              };

          // Store token temporarily so api.js can send it
          window.appState.token = token;
          await api.post(endpoint, body);
        }

        // ── Fetch authoritative user profile from backend ──────────────────
        window.appState.token = token;
        const { user, profile } = await api.get('/auth/me');
        setAuth(token, { ...user, ...profile });
        showToast('Welcome to Medilocker!');
        router.push('/dashboard');

      } catch (e) {
        // Translate Firebase auth error codes into readable messages
        const msg = e.code
          ? ({ 
              'auth/wrong-password':    'Incorrect password.',
              'auth/user-not-found':    'No account with that email.',
              'auth/email-already-in-use': 'Email already registered.',
              'auth/invalid-email':     'Invalid email address.',
              'auth/weak-password':     'Password must be at least 6 characters.',
            }[e.code] || e.message)
          : e.message;
        error.value = msg;
      } finally {
        loading.value = false;
      }
    }

    function demoLogin(r) {
      role.value           = r;
      form.email           = r === 'doctor' ? 'dr.nair@demo.health' : 'patient@demo.health';
      form.password        = 'demo123';
      form.displayName     = r === 'doctor' ? 'Dr. Meera Nair' : 'Aarav Shah';
      handleSubmit();
    }

    return { mode, role, loading, error, form, handleSubmit, demoLogin };
  },

  template: `
    <div class="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div class="absolute inset-0 pointer-events-none">
        <div class="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-sage-900/20 blur-3xl"></div>
        <div class="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-sage-800/10 blur-3xl"></div>
      </div>

      <div class="w-full max-w-md relative">
        <div class="text-center mb-10">
          <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-sage-900/50 border border-sage-700/30 mb-4">
            <span class="text-2xl">⊕</span>
          </div>
          <h1 class="serif text-3xl text-ink-100 mb-1">Medilocker</h1>
          <p class="text-ink-500 text-sm mono">Secure · Versioned · Transparent</p>
        </div>

        <!-- Demo buttons -->
        <div class="flex gap-2 mb-6">
          <button @click="demoLogin('patient')" class="btn-ghost flex-1 text-xs mono">→ Demo as Patient</button>
          <button @click="demoLogin('doctor')"  class="btn-ghost flex-1 text-xs mono">→ Demo as Doctor</button>
        </div>

        <div class="card p-6">
          <!-- Mode toggle -->
          <div class="flex gap-1 p-1 bg-ink-900 rounded-lg mb-6">
            <button
              v-for="m in ['login','register']" :key="m"
              @click="mode = m"
              class="flex-1 py-1.5 rounded-md text-xs mono transition-all"
              :class="mode === m ? 'bg-ink-700 text-ink-100' : 'text-ink-500 hover:text-ink-300'">
              {{ m === 'login' ? 'Sign In' : 'Register' }}
            </button>
          </div>

          <!-- Role selector (register only) -->
          <div v-if="mode === 'register'" class="flex gap-2 mb-4">
            <button
              v-for="r in ['patient','doctor']" :key="r"
              @click="role = r"
              class="flex-1 py-2 rounded-lg text-xs mono border transition-all"
              :class="role === r
                ? 'bg-sage-900/40 border-sage-700/50 text-sage-300'
                : 'bg-transparent border-ink-800 text-ink-500'">
              {{ r === 'patient' ? '◎ Patient' : '⊕ Doctor' }}
            </button>
          </div>

          <div v-if="error" class="mb-4 px-3 py-2 rounded-lg bg-red-950/50 border border-red-900/40 text-red-400 text-xs">
            {{ error }}
          </div>

          <form @submit.prevent="handleSubmit" class="space-y-4">
            <div v-if="mode === 'register'">
              <label>Full Name</label>
              <input v-model="form.displayName" type="text" class="input-field"
                :placeholder="role === 'doctor' ? 'Dr. Meera Nair' : 'Aarav Shah'" required />
            </div>
            <div>
              <label>Email</label>
              <input v-model="form.email" type="email" class="input-field" placeholder="you@example.com" required />
            </div>
            <div>
              <label>Password</label>
              <input v-model="form.password" type="password" class="input-field" placeholder="••••••••" required />
            </div>

            <!-- Patient fields -->
            <template v-if="mode === 'register' && role === 'patient'">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label>Date of Birth</label>
                  <input v-model="form.dateOfBirth" type="date" class="input-field" />
                </div>
                <div>
                  <label>Gender</label>
                  <select v-model="form.gender" class="input-field">
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label>Blood Group</label>
                <select v-model="form.bloodGroup" class="input-field">
                  <option value="">Select...</option>
                  <option v-for="bg in ['A+','A-','B+','B-','AB+','AB-','O+','O-']" :key="bg">{{ bg }}</option>
                </select>
              </div>
            </template>

            <!-- Doctor fields -->
            <template v-if="mode === 'register' && role === 'doctor'">
              <div>
                <label>Specialization</label>
                <input v-model="form.specialization" class="input-field" placeholder="Cardiology" />
              </div>
              <div>
                <label>License Number</label>
                <input v-model="form.licenseNumber" class="input-field" placeholder="MCI-12345" />
              </div>
              <div>
                <label>Qualifications (comma-separated)</label>
                <input v-model="form.qualifications" class="input-field" placeholder="MBBS, MD (Cardiology)" />
              </div>
              <div>
                <label>Years of Experience</label>
                <input v-model.number="form.yearsOfExperience" type="number" class="input-field" min="0" max="60" />
              </div>
            </template>

            <button type="submit" class="btn-primary w-full mt-2" :disabled="loading">
              <span v-if="loading" class="mono text-xs">◌ Processing...</span>
              <span v-else>{{ mode === 'login' ? 'Sign In →' : 'Create Account →' }}</span>
            </button>
          </form>
        </div>

        <p class="text-center text-ink-600 text-xs mt-6 mono">
          No ads · No ratings · Only transparent contribution data
        </p>
      </div>
    </div>
  `,
};

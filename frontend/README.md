# Medilocker Frontend — Fixed Edition

Vue 3 + Tailwind CSS frontend. No build step required. All API calls go to `http://localhost:3000/api`.

## What Was Fixed

### 1. Import Path Bugs
- `config/main.js` and `config/router.js` referenced the wrong paths — fixed so `main.js` and `router.js` live at the root and import from `./services/`, `./views/`, etc.

### 2. `defineComponent` Added
- All components/views now use `defineComponent()` for proper Vue 3 compatibility and DevTools support.

### 3. API Error Handling
- `api.js` now catches network errors (backend not running) with a friendly message.
- 401 responses automatically clear the stale token and redirect to login.
- Non-JSON responses (e.g. 204 No Content) no longer crash the app.

### 4. Firestore Timestamp Support
- `time.js` now handles both `{ seconds }` and `{ _seconds }` (REST API format) Firestore timestamps, and ISO strings.

### 5. Navigation Active State
- Sidebar uses Vue Router's built-in `router-link-active` class instead of manual `route.path ===` comparison.

### 6. Mobile Navigation
- Added a bottom navigation bar for mobile viewports with per-role items.
- `AppLayout` adds `padding-bottom` on small screens so content isn't hidden behind the nav.

### 7. `ContribGraph` Key Fix
- Week loop now uses index `wi` as key instead of `week[0].key` (which could be undefined).

### 8. Auth Flow
- `LoginView` no longer submits with an HTML `<form>` tag — uses `@click` on button + `@keyup.enter` on inputs to avoid accidental native form submission.

### 9. Defensive Null Checks
- Avatar initials, doctor names, timestamps — all guard against null/undefined.

---

## File Structure

```
frontend/
├── index.html               ← Entry point, CSS design system
├── main.js                  ← Vue app bootstrap + notification polling
├── router.js                ← Vue Router + auth guards
│
├── services/
│   ├── api.js               ← HTTP calls to localhost:3000/api
│   └── state.js             ← Global reactive state (token, user, unreadCount)
│
├── utils/
│   ├── time.js              ← relativeTime, daysUntil, daysLeft, formatBytes
│   └── contrib.js           ← getContribColor, buildContribWeeks
│
├── components/
│   ├── Toast.js             ← Global toast notifications
│   ├── Sidebar.js           ← Desktop navigation sidebar (role-aware)
│   ├── AppLayout.js         ← Layout wrapper + mobile bottom nav
│   └── ContribGraph.js      ← GitHub-style heatmap component
│
└── views/
    ├── LoginView.js
    ├── DashboardView.js
    ├── RecordsView.js
    ├── AccessRequestsView.js
    ├── CollaboratorsView.js
    ├── NotificationsView.js
    ├── DoctorsView.js
    └── DoctorProfileView.js
```

## Running Locally

```bash
cd frontend
npx serve . -l 5173
```

Open http://localhost:5173 — backend must be running at http://localhost:3000.

## Firebase Setup (optional)

Uncomment the Firebase SDK block in `index.html` and paste your config. Without it, the app falls back to `POST /api/auth/login`.

## API Endpoints

| View               | Endpoints |
|--------------------|-----------|
| Login / Register   | `POST /auth/login`, `/auth/register/patient`, `/auth/register/doctor` |
| Dashboard          | `GET /auth/me`, `/patients/:uid/commits`, `/notifications` |
| Records            | `GET /patients/:uid/records`, `POST /records` (multipart) |
| Version History    | `GET /records/:id/versions`, `GET /records/:id/versions/:vid/download` |
| Access Requests    | `GET /access-requests/incoming`, `/outgoing`, `POST /access-requests`, `PATCH /access-requests/:id/respond`, `PATCH /access-requests/:id/revoke` |
| Collaborators      | `GET /patients/:uid/collaborators` |
| Notifications      | `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` |
| Doctors            | `GET /doctors`, `GET /doctors/:uid`, `GET /doctors/:uid/contribution-graph`, `POST /doctors/:uid/endorse` |
| Doctor Profile     | `GET /doctors/:uid`, `GET /doctors/:uid/contribution-graph` |

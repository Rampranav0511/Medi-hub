# Medilocker Frontend — Structured Edition

Vue 3 frontend connected to `localhost:3000/api`. Every view fetches real data from your backend.

## File Structure

```
medilocker/
├── index.html               ← Entry point, CSS design system, Tailwind config
├── main.js                  ← Vue app bootstrap, notification polling
├── router.js                ← Vue Router config + auth guards
│
├── services/
│   ├── api.js               ← All HTTP calls to localhost:3000/api
│   └── state.js             ← Global reactive state (token, user, unreadCount)
│
├── utils/
│   ├── time.js              ← relativeTime, daysUntil, daysLeft, formatBytes
│   └── contrib.js           ← getContribColor, buildContribWeeks (for heatmap)
│
├── components/
│   ├── Toast.js             ← Global toast notifications
│   ├── Sidebar.js           ← Navigation sidebar (role-aware)
│   ├── AppLayout.js         ← Main layout wrapper
│   └── ContribGraph.js      ← GitHub-style heatmap (reusable)
│
└── views/
    ├── LoginView.js          ← Sign in / Register (Firebase + backend)
    ├── DashboardView.js      ← Stats + activity feed
    ├── RecordsView.js        ← Record list, upload, version history
    ├── AccessRequestsView.js ← Approve/deny/revoke access requests
    ├── CollaboratorsView.js  ← Active doctor access (patient view)
    ├── NotificationsView.js  ← Inbox with mark-read
    ├── DoctorsView.js        ← Doctor discovery with REAL contrib graphs
    └── DoctorProfileView.js  ← Doctor's own profile with REAL contrib graph
```

## Running Locally

```bash
# Serve with any static server (must be HTTP, not file://)
npx serve . -l 5173
# or
python3 -m http.server 5173
```

Open http://localhost:5173 — the backend must be running at http://localhost:3000.

## Firebase Setup (optional but recommended)

1. In `index.html`, find the commented `<!-- Optional: Firebase SDK -->` block
2. Uncomment it and paste your Firebase config from the Firebase Console
3. Auth flow: Firebase token → backend verifies with Admin SDK

Without Firebase, the app falls back to a direct `/api/auth/login` endpoint.

## API Endpoints Used

| View               | Endpoint(s)                                                   |
|--------------------|---------------------------------------------------------------|
| Login / Register   | `POST /auth/login`, `/auth/register/patient`, `/auth/register/doctor` |
| Dashboard          | `GET /auth/me`, `/patients/:uid/commits`, `/notifications`    |
| Records            | `GET /patients/:uid/records`, `POST /records` (multipart)    |
| Version History    | `GET /records/:id/versions`                                   |
| File Download      | `GET /records/:id/versions/:vid/download`                     |
| Access Requests    | `GET /access-requests/incoming`, `/outgoing`                  |
|                    | `POST /access-requests`                                       |
|                    | `PATCH /access-requests/:id/respond`                          |
|                    | `PATCH /access-requests/:id/revoke`                           |
| Collaborators      | `GET /patients/:uid/collaborators`                            |
| Notifications      | `GET /notifications`                                          |
|                    | `PATCH /notifications/:id/read`                               |
|                    | `PATCH /notifications/read-all`                               |
| Doctors            | `GET /doctors` (query: specialization, sortBy, minCases)      |
|                    | `GET /doctors/:uid`                                           |
|                    | `GET /doctors/:uid/contribution-graph` ← **REAL graph data**  |
|                    | `POST /doctors/:uid/endorse`                                  |
| Doctor Profile     | `GET /doctors/:uid`                                           |
|                    | `GET /doctors/:uid/contribution-graph` ← **REAL graph data**  |

## Contribution Graph

The contribution heatmap is now real data from your Firestore. 

`GET /doctors/:uid/contribution-graph` should return:
```json
{
  "contributionGraph": {
    "2025-01-15": 3,
    "2025-01-16": 1,
    "2025-02-03": 5
  },
  "summary": {
    "totalContributions": 142,
    "currentStreak": 7,
    "longestStreak": 21
  }
}
```

This is generated and cached in Firestore by `updateDoctorStats()` in your backend.

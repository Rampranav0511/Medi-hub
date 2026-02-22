// ─── Time utilities ───────────────────────────────────────────────────────────

/**
 * Accepts a Firestore-style { seconds } timestamp OR an ISO string OR a Date.
 * Returns a human-readable relative string, e.g. "2h ago", "3d ago".
 */
export function relativeTime(ts) {
  if (!ts) return 'Unknown';
  let secs;
  if (ts.seconds !== undefined) {
    secs = Date.now() / 1000 - ts.seconds;
  } else {
    secs = (Date.now() - new Date(ts).getTime()) / 1000;
  }
  if (secs < 60)    return 'just now';
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

/** Returns "Xd remaining" or "Expired" from a Firestore timestamp. */
export function daysUntil(ts) {
  if (!ts) return '';
  const seconds = ts.seconds !== undefined ? ts.seconds : new Date(ts).getTime() / 1000;
  const days = Math.ceil((seconds - Date.now() / 1000) / 86400);
  return days > 0 ? `${days}d remaining` : 'Expired';
}

/** Integer days left (can be negative if expired). */
export function daysLeft(ts) {
  if (!ts) return 0;
  const seconds = ts.seconds !== undefined ? ts.seconds : new Date(ts).getTime() / 1000;
  return Math.ceil((seconds - Date.now() / 1000) / 86400);
}

/** Format bytes → "1.2 MB" etc. */
export function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Contribution Graph Utilities ─────────────────────────────────────────────

/**
 * Returns a colour string for a given activity count.
 * Uses Medilocker's sage-green palette.
 */
export function getContribColor(count) {
  if (!count || count === 0) return '#1a1a17';
  if (count === 1) return '#1f3d1f';
  if (count === 2) return '#2d6e2d';
  if (count === 3) return '#3d8b3d';
  return '#60a860';
}

/**
 * Converts a flat contributionGraph object from the API:
 *   { "2025-01-15": 3, "2025-01-16": 1, ... }
 * into a 2D array of 26 weeks × 7 days for rendering.
 *
 * @param {Object} graphData  - from API /doctors/:id/contribution-graph
 * @returns {Array}           - [ [ { key, count }, ... ], ... ]  (26 weeks)
 */
export function buildContribWeeks(graphData = {}) {
  const today = new Date();
  const weeks = [];

  for (let w = 25; w >= 0; w--) {
    const week = [];
    for (let d = 6; d >= 0; d--) {
      const date = new Date(today);
      date.setDate(date.getDate() - (w * 7 + d));
      const key = date.toISOString().split('T')[0];
      week.push({ key, count: graphData[key] || 0 });
    }
    weeks.push(week);
  }
  return weeks;
}

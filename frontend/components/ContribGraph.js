// ─── ContribGraph Component ───────────────────────────────────────────────────
// Renders a GitHub-style contribution heatmap.
// Usage: <ContribGraph :graph-data="{ '2025-01-15': 3, ... }" />

import { getContribColor, buildContribWeeks } from '../utils/contrib.js';

const { computed } = Vue;

export const ContribGraph = {
  props: {
    graphData: { type: Object, default: () => ({}) },
  },
  setup(props) {
    const weeks = computed(() => buildContribWeeks(props.graphData));
    const colors = ['#1a1a17', '#1f3d1f', '#2d6e2d', '#3d8b3d', '#60a860'];
    return { weeks, colors, getContribColor };
  },
  template: `
    <div>
      <div class="flex gap-1 overflow-x-auto pb-2">
        <div v-for="week in weeks" :key="week[0].key" class="flex flex-col gap-1">
          <div
            v-for="day in week" :key="day.key"
            class="contribution-cell"
            :style="{ background: getContribColor(day.count) }"
            :title="day.key + ': ' + day.count + ' contributions'">
          </div>
        </div>
      </div>
      <div class="flex items-center gap-1 mt-2 justify-end">
        <span class="mono text-[10px] text-ink-700">Less</span>
        <div v-for="c in colors" :key="c"
          class="w-3 h-3 rounded-sm" :style="{ background: c }"></div>
        <span class="mono text-[10px] text-ink-700">More</span>
      </div>
    </div>
  `,
};

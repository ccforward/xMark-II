<template>
  <div class="stats-section">
    <h3>Tweet Activity (Last 12 months)</h3>
    <div class="heatmap-container">
      <div class="heatmap-months">
        <span v-for="m in heatmap.months" :key="m.label" :style="{ left: m.offset + 'px' }">{{ m.label }}</span>
      </div>
      <div class="heatmap-grid">
        <div class="heatmap-days-label">
          <span>Mon</span>
          <span>Wed</span>
          <span>Fri</span>
        </div>
        <div class="heatmap-weeks">
          <div v-for="(week, wi) in heatmap.weeks" :key="wi" class="heatmap-week">
            <div
              v-for="(day, di) in week"
              :key="di"
              class="heatmap-cell"
              :class="'level-' + day.level"
              :title="day.date + ': ' + day.count + ' bookmarks'"
            ></div>
          </div>
        </div>
      </div>
      <div class="heatmap-legend">
        <span>Less</span>
        <div class="heatmap-cell level-0"></div>
        <div class="heatmap-cell level-1"></div>
        <div class="heatmap-cell level-2"></div>
        <div class="heatmap-cell level-3"></div>
        <div class="heatmap-cell level-4"></div>
        <span>More</span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  heatmap: { type: Object, required: true },
})
</script>

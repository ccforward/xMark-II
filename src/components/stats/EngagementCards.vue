<template>
  <div class="stats-section">
    <h3>Engagement Summary</h3>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-number">{{ formatNum(engagement.totalLikes) }}</div>
        <div class="stat-label">Total Likes</div>
        <div class="stat-sub">Avg {{ formatNum(engagement.avgLikes) }}/tweet</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ formatNum(engagement.totalRetweets) }}</div>
        <div class="stat-label">Total Reposts</div>
        <div class="stat-sub">Avg {{ formatNum(engagement.avgRetweets) }}/tweet</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ formatNum(engagement.totalReplies) }}</div>
        <div class="stat-label">Total Replies</div>
        <div class="stat-sub">Avg {{ formatNum(engagement.avgReplies) }}/tweet</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ formatNum(engagement.totalViews) }}</div>
        <div class="stat-label">Total Views</div>
        <div class="stat-sub">Avg {{ formatNum(engagement.avgViews) }}/tweet</div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  engagement: { type: Object, required: true },
})

function formatNum(n) {
  if (!n) return '0'
  n = parseInt(n)
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}
</script>

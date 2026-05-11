<template>
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-number">{{ stats.total || 0 }}</div>
      <div class="stat-label">Total Bookmarks</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">{{ stats.withMedia || 0 }}</div>
      <div class="stat-label">With Media</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">{{ stats.withVideo || 0 }}</div>
      <div class="stat-label">With Video</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">{{ stats.withArticles || 0 }}</div>
      <div class="stat-label">Articles</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">{{ stats.withNotes || 0 }}</div>
      <div class="stat-label">Notes</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">{{ stats.topAuthors?.length || 0 }}</div>
      <div class="stat-label">Unique Authors</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">{{ stats.uncategorized || 0 }}</div>
      <div class="stat-label">Uncategorized</div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  stats: { type: Object, required: true },
})
</script>

<template>
  <div class="stats-section">
    <h3>Top Authors</h3>
    <div class="top-authors-list">
      <div v-for="a in authors.slice(0, 10)" :key="a.handle" class="top-author-item">
        <img v-if="a.avatar" :src="a.avatar" class="top-author-avatar" />
        <div v-else class="top-author-avatar placeholder-avatar">{{ (a.name || '?')[0] }}</div>
        <div class="top-author-info">
          <span class="top-author-name">{{ a.name }}</span>
          <span class="top-author-handle">@{{ a.handle }}</span>
        </div>
        <span class="top-author-count">{{ a.count }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  authors: { type: Array, required: true },
})
</script>

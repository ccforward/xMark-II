<template>
  <div class="stats-section">
    <h3>{{ title }}</h3>
    <div class="distribution-list">
      <div v-for="item in items" :key="item.name" class="distribution-item">
        <span class="distribution-name">{{ prefix }}{{ item.name }}</span>
        <div class="distribution-bar-container">
          <div
            class="distribution-bar"
            :class="{ 'tag-bar': variant === 'tag' }"
            :style="{ width: (item.count / total * 100) + '%' }"
          ></div>
        </div>
        <span class="distribution-count">{{ item.count }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  items: { type: Array, required: true },
  total: { type: Number, required: true },
  prefix: { type: String, default: '' },
  variant: { type: String, default: '' },
})
</script>

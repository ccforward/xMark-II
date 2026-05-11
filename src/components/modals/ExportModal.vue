<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <h2 class="modal-title">Export Bookmarks</h2>
      <p style="color:var(--text-secondary);margin-bottom:16px;font-size:14px">Choose a format. JSON is best for AI processing and re-importing.</p>
      <div class="export-options">
        <button class="btn btn-primary" @click="$emit('export', 'json')">JSON</button>
        <button class="btn btn-secondary" @click="$emit('export', 'csv')">CSV</button>
        <button class="btn btn-secondary" @click="$emit('export', 'markdown')">Markdown</button>
      </div>
      <div class="form-group" style="margin-top:16px">
        <label class="form-label">Category filter</label>
        <select v-model="category" class="form-input">
          <option value="all">All categories</option>
          <option value="uncategorized">Uncategorized only</option>
          <option v-for="cat in categories" :key="cat.name" :value="cat.name">{{ cat.name }}</option>
        </select>
      </div>
      <button class="btn btn-secondary" style="margin-top:12px" @click="$emit('close')">Cancel</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({ categories: Array })
defineEmits(['close', 'export'])

const category = ref('all')
defineExpose({ category })
</script>

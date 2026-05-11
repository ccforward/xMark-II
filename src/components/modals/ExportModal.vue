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
      <button class="btn btn-secondary" style="margin-top:16px" @click="$emit('close')">Cancel</button>
    </div>
  </div>
</template>

<script setup>
defineEmits(['close', 'export'])
</script>

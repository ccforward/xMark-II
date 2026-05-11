<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <h2 class="modal-title">Share Collection</h2>
      <p style="color:var(--text-secondary);margin-bottom:16px;font-size:14px">
        Generate a shareable summary as text or markdown.
      </p>
      <div class="form-group">
        <label class="form-label">Format</label>
        <div class="export-options">
          <button class="btn btn-primary" @click="$emit('share', 'text')">Copy as Text</button>
          <button class="btn btn-secondary" @click="$emit('share', 'markdown')">Copy as Markdown</button>
        </div>
      </div>
      <div v-if="content" class="form-group" style="margin-top:16px">
        <textarea class="form-input" rows="8" readonly :value="content"></textarea>
        <p style="color:var(--success);font-size:13px;margin-top:4px">Copied to clipboard!</p>
      </div>
      <button class="btn btn-secondary" style="margin-top:12px" @click="$emit('close')">Close</button>
    </div>
  </div>
</template>

<script setup>
defineProps({ content: String })
defineEmits(['close', 'share'])
</script>

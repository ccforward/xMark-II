<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <h2 class="modal-title">Settings</h2>
      <div class="form-group">
        <label class="form-label">Auto-sync interval (minutes)</label>
        <select v-model="interval" class="form-input" @change="$emit('update-interval', interval)">
          <option :value="0">Disabled</option>
          <option :value="15">Every 15 minutes</option>
          <option :value="30">Every 30 minutes</option>
          <option :value="60">Every hour</option>
          <option :value="120">Every 2 hours</option>
          <option :value="360">Every 6 hours</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Keyboard Shortcuts</label>
        <div class="shortcuts-list">
          <div class="shortcut-item"><kbd>/</kbd> Focus search</div>
          <div class="shortcut-item"><kbd>j</kbd> / <kbd>k</kbd> Navigate bookmarks</div>
          <div class="shortcut-item"><kbd>x</kbd> Toggle selection</div>
          <div class="shortcut-item"><kbd>o</kbd> Open on X</div>
          <div class="shortcut-item"><kbd>Esc</kbd> Close modal / lightbox</div>
          <div class="shortcut-item"><kbd>&larr;</kbd> / <kbd>&rarr;</kbd> Lightbox navigation</div>
        </div>
      </div>
      <div class="modal-actions" style="margin-top:16px">
        <button class="btn btn-primary" @click="$emit('open-ai-settings')">AI Settings</button>
        <button class="btn btn-secondary" @click="$emit('close')">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({ autoSyncInterval: Number })
defineEmits(['close', 'update-interval', 'open-ai-settings'])

const interval = ref(props.autoSyncInterval || 30)
</script>

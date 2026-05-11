<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <h2 class="modal-title">Edit Note</h2>
      <textarea v-model="note" class="form-input" rows="4" placeholder="Add a note for this bookmark..."></textarea>
      <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end">
        <button class="btn btn-secondary" @click="$emit('close')">Cancel</button>
        <button class="btn btn-primary" @click="$emit('save', note)">Save</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({ initialNote: String })
defineEmits(['close', 'save'])

const note = ref(props.initialNote || '')
</script>

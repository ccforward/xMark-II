<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <h2 class="modal-title">Create Collection</h2>
      <div class="form-group">
        <label class="form-label">Name</label>
        <input v-model="name" class="form-input" placeholder="Collection name..." @keyup.enter="create" />
      </div>
      <div class="form-group">
        <label class="form-label">Description (optional)</label>
        <textarea v-model="desc" class="form-input" rows="2" placeholder="What's this collection about?"></textarea>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-secondary" @click="$emit('close')">Cancel</button>
        <button class="btn btn-primary" @click="create">Create</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['close', 'create'])

const name = ref('')
const desc = ref('')

function create() {
  const n = name.value.trim()
  if (!n) return
  emit('create', n, desc.value.trim())
  name.value = ''
  desc.value = ''
}
</script>

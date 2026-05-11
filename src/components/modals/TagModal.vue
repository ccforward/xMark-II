<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <h2 class="modal-title">Manage Tags</h2>
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <input v-model="newName" class="form-input" placeholder="New tag name..." @keyup.enter="create" />
        <button class="btn btn-primary btn-sm" @click="create">Add</button>
      </div>
      <div class="category-list">
        <div v-for="tag in tags" :key="tag.name" class="category-list-item">
          <span class="tag-dot" :style="{ background: tag.color }"></span>
          <span class="name">{{ tag.name }}</span>
          <div class="actions">
            <button class="icon-btn" title="Rename" @click="rename(tag.name)"><PenLine :size="14" /></button>
            <button class="icon-btn" title="Delete" @click="remove(tag.name)"><Trash2 :size="14" /></button>
          </div>
        </div>
        <div v-if="tags.length === 0" style="color:var(--text-muted);text-align:center;padding:20px">No tags yet.</div>
      </div>
      <button class="btn btn-secondary" style="margin-top:16px" @click="$emit('close')">Close</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { PenLine, Trash2 } from 'lucide-vue-next'

defineProps({ tags: Array })
const emit = defineEmits(['close', 'create', 'rename', 'delete'])

const newName = ref('')

function create() {
  const name = newName.value.trim()
  if (!name) return
  emit('create', name)
  newName.value = ''
}

function rename(name) {
  const newN = prompt('New tag name:', name)
  if (newN && newN !== name) emit('rename', name, newN)
}

function remove(name) {
  if (confirm(`Delete tag "${name}"?`)) emit('delete', name)
}
</script>

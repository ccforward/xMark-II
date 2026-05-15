<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal" style="max-width:480px">
      <h2 class="modal-title">Manage Collections</h2>
      <div v-if="collections.length === 0" class="empty-hint">No collections yet</div>
      <div v-else class="collection-manage-list">
        <div v-for="col in collections" :key="col.id" class="collection-manage-item">
          <div class="collection-manage-info">
            <span class="collection-manage-name">{{ col.name }}</span>
            <span class="collection-manage-count">{{ col.bookmarkIds?.length || 0 }} bookmarks</span>
          </div>
          <div class="collection-manage-actions">
            <button class="btn btn-sm btn-secondary" @click="renameCollection(col)">Rename</button>
            <button class="btn btn-sm btn-secondary" style="color:var(--danger)" @click="confirmDelete(col)">Delete</button>
          </div>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:16px">
        <button class="btn btn-secondary" @click="$emit('close')">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  collections: Array,
})

const emit = defineEmits(['close', 'rename', 'delete'])

function renameCollection(col) {
  const newName = prompt('Rename collection:', col.name)
  if (!newName || newName.trim() === col.name) return
  emit('rename', col.id, newName.trim())
}

function confirmDelete(col) {
  if (!confirm(`Delete collection "${col.name}"? Bookmarks will not be deleted.`)) return
  emit('delete', col.id)
}
</script>

<template>
  <div v-if="selectedIds.size > 0" class="bulk-actions">
    <span class="count">{{ selectedIds.size }} selected</span>
    <button class="btn btn-sm" @click="handleCategorize">Categorize</button>
    <button class="btn btn-sm" @click="handleTag">Tag</button>
    <button class="btn btn-sm" @click="handleCollection">Add to Collection</button>
    <button class="btn btn-sm" @click="$emit('export')">Export</button>
    <button class="btn btn-sm" @click="$emit('clear')">Deselect</button>
  </div>
</template>

<script setup>
const props = defineProps({
  selectedIds: { type: Set, required: true },
  collections: Array,
})

const emit = defineEmits(['categorize', 'tag', 'collection', 'export', 'clear'])

function handleCategorize() {
  const name = prompt('Category name to assign:')
  if (name) emit('categorize', name)
}

function handleTag() {
  const name = prompt('Tag name to assign:')
  if (name) emit('tag', name)
}

function handleCollection() {
  if (!props.collections?.length) { alert('Create a collection first.'); return }
  const name = prompt('Collection name:\n' + props.collections.map(c => c.name).join(', '))
  if (!name) return
  const col = props.collections.find(c => c.name === name)
  if (!col) { alert('Collection not found.'); return }
  emit('collection', col.id)
}
</script>

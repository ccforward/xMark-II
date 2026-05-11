<template>
  <div v-if="selectedIds.size > 0" class="bulk-actions">
    <span class="count">{{ selectedIds.size }} selected</span>

    <div class="bulk-dropdown-wrapper">
      <button class="btn btn-sm" @click="toggleTagDropdown">Tag</button>
      <div v-if="showTagDropdown" class="bulk-dropdown-menu">
        <div v-for="tag in tags" :key="tag.name" class="bulk-dropdown-item" @click="selectTag(tag.name)">
          <span class="tag-dot" :style="{ background: tag.color }"></span>
          {{ tag.name }}
        </div>
        <div v-if="tags.length === 0" class="bulk-dropdown-item disabled">No tags yet</div>
      </div>
    </div>

    <div class="bulk-dropdown-wrapper">
      <button class="btn btn-sm" @click="toggleCollectionDropdown">Add to Collection</button>
      <div v-if="showCollectionDropdown" class="bulk-dropdown-menu">
        <div v-for="col in collections" :key="col.id" class="bulk-dropdown-item" @click="selectCollection(col.id)">
          {{ col.name }}
        </div>
        <div v-if="collections.length === 0" class="bulk-dropdown-item" @click="$emit('create-collection')">
          + Create new collection...
        </div>
      </div>
    </div>

    <button class="btn btn-sm" @click="$emit('export')">Export</button>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  selectedIds: { type: Set, required: true },
  tags: Array,
  collections: Array,
})

const emit = defineEmits(['tag', 'collection', 'export', 'create-collection'])

const showTagDropdown = ref(false)
const showCollectionDropdown = ref(false)

function toggleTagDropdown() {
  showTagDropdown.value = !showTagDropdown.value
  showCollectionDropdown.value = false
}

function toggleCollectionDropdown() {
  showCollectionDropdown.value = !showCollectionDropdown.value
  showTagDropdown.value = false
}

function selectTag(name) {
  emit('tag', name)
  showTagDropdown.value = false
}

function selectCollection(id) {
  emit('collection', id)
  showCollectionDropdown.value = false
}

function handleClickOutside(e) {
  if (!e.target.closest('.bulk-dropdown-wrapper')) {
    showTagDropdown.value = false
    showCollectionDropdown.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

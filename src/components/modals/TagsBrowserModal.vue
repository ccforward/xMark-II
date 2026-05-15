<template>
  <div class="tags-modal-overlay" @click.self="$emit('close')">
    <div class="tags-modal">
      <div class="tags-modal-header">
        <h3>All Tags ({{ sortedTags.length }})</h3>
        <button class="icon-btn" @click="$emit('close')">&times;</button>
      </div>
      <div class="tags-modal-search">
        <input ref="searchInput" v-model="search" class="form-input" placeholder="Search tags..." />
      </div>
      <div class="tags-modal-body">
        <div class="tags-modal-capsules">
          <div
            v-for="tag in filteredTags"
            :key="tag.name"
            class="tag-capsule"
            :class="{ active: currentView === 'tag:' + tag.name }"
            @click="select(tag.name)"
          >
            <span class="tag-capsule-dot" :style="{ background: tag.color }"></span>
            <span class="tag-capsule-name">{{ tag.name }}</span>
            <span class="tag-capsule-count">{{ formatCount(tagCounts[tag.name] || 0) }}</span>
          </div>
        </div>
        <div v-if="filteredTags.length === 0" class="tags-modal-empty">
          No tags matching "{{ search }}"
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'

const props = defineProps({
  tags: Array,
  tagCounts: Object,
  currentView: String,
})

const emit = defineEmits(['close', 'select'])

const search = ref('')
const searchInput = ref(null)

const sortedTags = computed(() => {
  const counts = props.tagCounts || {}
  return [...props.tags].sort((a, b) => (counts[b.name] || 0) - (counts[a.name] || 0))
})

const filteredTags = computed(() => {
  if (!search.value) return sortedTags.value
  const q = search.value.toLowerCase()
  return sortedTags.value.filter(t => t.name.toLowerCase().includes(q))
})

function formatCount(n) {
  if (!n) return '0'
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

function select(name) {
  emit('select', name)
  emit('close')
}

onMounted(() => {
  nextTick(() => searchInput.value?.focus())
})
</script>

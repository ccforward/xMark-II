<template>
  <aside class="sidebar">
    <div class="sidebar-brand">xMark</div>

    <div class="sidebar-section-title">View</div>
    <div class="sidebar-item" :class="{ active: currentView === 'all' }" @click="$emit('navigate', 'all')">
      <BookmarkCheck :size="18" /><span>All Bookmarks</span>
      <span class="count">{{ formatCount(bookmarkCount) }}</span>
    </div>
    <div class="sidebar-item" :class="{ active: currentView === 'stats' }" @click="$emit('navigate', 'stats')">
      <BarChart3 :size="18" /><span>Statistics</span>
    </div>
    <div class="sidebar-item" :class="{ active: currentView === 'rankings' }" @click="$emit('navigate', 'rankings')">
      <Trophy :size="18" /><span>Rankings</span>
    </div>

    <div class="sidebar-section-title">Tags <span v-if="sortedTags.length > 0" class="count">{{ sortedTags.length }}</span></div>
    <div class="sidebar-tags-list">
      <div
        v-for="tag in visibleTags"
        :key="tag.name"
        class="sidebar-tag-chip"
        :class="{ active: currentView === 'tag:' + tag.name }"
        @click="$emit('navigate', 'tag:' + tag.name)"
      >
        <span class="sidebar-tag-dot" :style="{ background: tag.color }"></span>
        <span class="sidebar-tag-name">{{ tag.name }}</span>
        <span class="sidebar-tag-count">{{ formatCount(tagCounts[tag.name] || 0) }}</span>
      </div>
    </div>
    <div v-if="sortedTags.length > 6" class="sidebar-more-btn" @click="$emit('show-tags-modal')">
      View all {{ sortedTags.length }} tags
    </div>
    <div class="sidebar-collection-actions">
      <button v-if="sortedTags.length > 0" class="sidebar-action-btn" @click="$emit('action', 'manageTags')">
        <Settings :size="14" /> Manage
      </button>
    </div>

    <div class="sidebar-section-title">Collections <span v-if="collections.length > 0" class="count">{{ collections.length }}</span></div>
    <div class="sidebar-collections-list">
      <div
        v-for="col in collections"
        :key="col.id"
        class="sidebar-collection-item"
        :class="{ active: currentView === 'collection:' + col.id }"
        @click="$emit('navigate', 'collection:' + col.id)"
      >
        <Library :size="16" />
        <span class="sidebar-collection-name">{{ col.name }}</span>
        <span class="sidebar-collection-count">{{ formatCount(col.bookmarkIds?.length || 0) }}</span>
      </div>
    </div>
    <div class="sidebar-collection-actions">
      <button class="sidebar-action-btn" @click="$emit('action', 'createCollection')">
        <Plus :size="14" /> New
      </button>
      <button v-if="collections.length > 0" class="sidebar-action-btn" @click="$emit('action', 'manageCollections')">
        <Settings :size="14" /> Manage
      </button>
    </div>

    <div class="sidebar-section-title" style="margin-top:auto">Actions</div>
    <div class="sidebar-item" @click="$emit('action', 'export')">
      <Upload :size="18" /><span>Export</span>
    </div>
    <div class="sidebar-item" :class="{ active: currentView === 'settings' }" @click="$emit('navigate', 'settings')">
      <Settings :size="18" /><span>Settings</span>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { BookmarkCheck, BarChart3, Trophy, Library, Plus, Upload, Settings } from 'lucide-vue-next'

const props = defineProps({
  currentView: String,
  tags: Array,
  tagCounts: Object,
  collections: Array,
  bookmarkCount: Number,
})

defineEmits(['navigate', 'action', 'show-tags-modal'])

const sortedTags = computed(() => {
  const counts = props.tagCounts || {}
  return [...props.tags].sort((a, b) => (counts[b.name] || 0) - (counts[a.name] || 0))
})

const visibleTags = computed(() => sortedTags.value.slice(0, 6))

function formatCount(n) {
  if (!n) return '0'
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}
</script>

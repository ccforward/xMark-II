<template>
  <aside class="sidebar">
    <div class="sidebar-brand">xMark</div>

    <div class="sidebar-section-title">View</div>
    <div class="sidebar-item" :class="{ active: currentView === 'all' }" @click="$emit('navigate', 'all')">
      <BookmarkCheck :size="18" /><span>All Bookmarks</span>
      <span class="count">{{ bookmarkCount }}</span>
    </div>
    <div class="sidebar-item" :class="{ active: currentView === 'stats' }" @click="$emit('navigate', 'stats')">
      <BarChart3 :size="18" /><span>Statistics</span>
    </div>
    <div class="sidebar-item" :class="{ active: currentView === 'duplicates' }" @click="$emit('navigate', 'duplicates')">
      <SearchIcon :size="18" /><span>Duplicates</span>
    </div>

    <div class="sidebar-section-title">Tags</div>
    <div
      v-for="tag in tags"
      :key="tag.name"
      class="sidebar-item"
      :class="{ active: currentView === 'tag:' + tag.name }"
      @click="$emit('navigate', 'tag:' + tag.name)"
    >
      <span class="tag-dot" :style="{ background: tag.color }"></span>
      <span>{{ tag.name }}</span>
    </div>

    <div class="sidebar-section-title">Collections</div>
    <div
      v-for="col in collections"
      :key="col.id"
      class="sidebar-item"
      :class="{ active: currentView === 'collection:' + col.id }"
      @click="$emit('navigate', 'collection:' + col.id)"
    >
      <Library :size="18" /><span>{{ col.name }}</span>
    </div>
    <div class="sidebar-item" @click="$emit('action', 'createCollection')">
      <Plus :size="18" /><span>New Collection</span>
    </div>

    <div class="sidebar-section-title" style="margin-top:auto">Actions</div>
    <div class="sidebar-item" @click="$emit('action', 'export')">
      <Upload :size="18" /><span>Export</span>
    </div>
    <div class="sidebar-item" @click="$emit('action', 'manageTags')">
      <Tag :size="18" /><span>Manage Tags</span>
    </div>
    <div class="sidebar-item" @click="$emit('action', 'settings')">
      <Settings :size="18" /><span>Settings</span>
    </div>
  </aside>
</template>

<script setup>
import { BookmarkCheck, BarChart3, Search as SearchIcon, Library, Plus, Upload, Tag, Settings } from 'lucide-vue-next'

defineProps({
  currentView: String,
  tags: Array,
  collections: Array,
  bookmarkCount: Number,
})

defineEmits(['navigate', 'action'])
</script>

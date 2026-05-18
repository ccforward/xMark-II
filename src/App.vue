<template>
  <div class="app-layout">
    <AppSidebar
      :currentView="currentView"
      :tags="tags"
      :tagCounts="tagCounts"
      :collections="collections"
      :bookmarkCount="stats.bookmarkCount"
      @navigate="handleNavigate"
      @action="handleAction"
      @show-tags-modal="showTagsBrowserModal = true"
    />

    <main class="main-content">
      <!-- Stats View -->
      <StatsView v-if="currentView === 'stats'" :statsData="statsData" />

      <!-- Rankings View -->
      <TopTweetsView v-else-if="currentView === 'rankings'" :statsData="statsData" @delete="handleDeleteFromRankings" />

      <!-- Settings View -->
      <SettingsView v-else-if="currentView === 'settings'" :aiConfig="aiConfig" @save-ai-config="handleSaveAIConfig" />

      <!-- Bookmarks List View -->
      <template v-else>
        <!-- Header -->
        <div class="page-header">
          <h1 class="page-title">{{ viewTitle }}</h1>
          <div class="header-actions">
            <div class="search-box">
              <Search :size="16" class="search-icon" />
              <input v-model="searchQuery" placeholder="Search bookmarks..." @input="debouncedSearch" />
            </div>
            <button class="btn btn-secondary btn-sm" @click="showAdvancedSearch = !showAdvancedSearch">
              {{ showAdvancedSearch ? 'Simple' : 'Advanced' }}
            </button>
            <div class="sort-toggle">
              <button class="btn btn-secondary btn-sm" :class="{ active: sortOrder === 'desc' }" @click="setSortOrder('desc')" title="Newest first">
                <ArrowDown :size="14" /> Newest
              </button>
              <button class="btn btn-secondary btn-sm" :class="{ active: sortOrder === 'asc' }" @click="setSortOrder('asc')" title="Oldest first">
                <ArrowUp :size="14" /> Oldest
              </button>
            </div>
            <button class="btn btn-primary" :disabled="syncState === 'syncing'" @click="handleSync(false)">
              <span v-if="syncState === 'syncing'" class="spinner"></span>
              {{ syncState === 'syncing' ? 'Syncing...' : 'Sync' }}
            </button>
            <button class="btn btn-secondary" :disabled="syncState === 'syncing'" @click="handleSync(true)">Full Sync</button>
          </div>
        </div>

        <!-- Advanced Search -->
        <div v-if="showAdvancedSearch" class="advanced-search">
          <div class="filter-row">
            <div class="filter-item">
              <label>Author</label>
              <input v-model="filters.author" class="form-input" placeholder="Username..." @input="debouncedSearch" />
            </div>
            <div class="filter-item">
              <label>From</label>
              <input v-model="filters.dateFrom" type="date" class="form-input" @change="loadBookmarks" />
            </div>
            <div class="filter-item">
              <label>To</label>
              <input v-model="filters.dateTo" type="date" class="form-input" @change="loadBookmarks" />
            </div>
            <div class="filter-item">
              <label>Media</label>
              <select v-model="filters.mediaType" class="form-input" @change="loadBookmarks">
                <option value="">All</option>
                <option value="media">Has images</option>
                <option value="video">Has video</option>
              </select>
            </div>
          </div>
          <button class="btn btn-sm btn-secondary" @click="clearFilters">Clear Filters</button>
        </div>

        <!-- Sync Status (floating) -->
        <div v-if="syncMessage" class="sync-status-floating" :class="syncState">
          <span class="sync-status-text">{{ syncMessage }}</span>
          <button v-if="syncState === 'error'" class="sync-status-close" @click="dismissStatus">&times;</button>
        </div>

        <!-- Bulk Actions -->
        <BulkActions
          :selectedIds="selectedIds"
          :tags="tags"
          :collections="collections"
          @tag="bulkTag"
          @collection="bulkAddToCollection"
          @export="handleBulkExport"
          @create-collection="showCreateCollectionModal = true"
        />

        <!-- Bookmark List -->
        <div v-if="bookmarks.length > 0" class="bookmark-list">
          <BookmarkItem
            v-for="bm in bookmarks"
            :key="bm.id"
            :bookmark="bm"
            :selected="selectedIds.has(bm.id)"
            :tags="tags"
            :collections="collections"
            :openDropdownId="openDropdownId"
            :dropdownType="dropdownType"
            :aiProcessingThis="aiProcessingIds.has(bm.id)"
            @toggle-select="toggleSelect"
            @open-media="openMedia"
            @remove-tag="removeTag"
            @toggle-dropdown="toggleDropdown"
            @add-tag="addTag"
            @add-to-collection="addToCollection"
            @remove-from-collection="removeFromCollection"
            @prompt-new-tag="promptNewTag"
            @prompt-new-collection="promptNewCollection"
            @edit-note="openNoteEditor"
            @delete="handleDelete"
            @ai-process="handleAIProcess"
          />
        </div>

        <div v-else class="empty-state">
          <h3>No bookmarks yet</h3>
          <p>Click "Sync" to start importing your X bookmarks</p>
        </div>

        <div v-if="bookmarks.length < total" ref="scrollTrigger" class="load-more">
          <span class="spinner"></span> Loading more...
        </div>
        <div v-else-if="bookmarks.length > 0" class="load-more-end">
          All {{ total }} bookmarks loaded
        </div>
      </template>
    </main>

    <!-- Media Lightbox -->
    <div v-if="lightbox.visible" class="lightbox-overlay" @click.self="closeLightbox" @wheel.prevent="handleLightboxWheel">
      <button class="lightbox-close" @click="closeLightbox">&times;</button>
      <button v-if="lightbox.items.length > 1 && lightbox.index > 0" class="lightbox-nav lightbox-prev" @click="lightbox.index--; lightbox.scale = 1; lightbox.panX = 0; lightbox.panY = 0">&lsaquo;</button>
      <button v-if="lightbox.items.length > 1 && lightbox.index < lightbox.items.length - 1" class="lightbox-nav lightbox-next" @click="lightbox.index++; lightbox.scale = 1; lightbox.panX = 0; lightbox.panY = 0">&rsaquo;</button>
      <!-- Toolbar -->
      <div class="lightbox-toolbar">
        <button class="lightbox-tool-btn" @click="lightbox.scale = Math.min(lightbox.scale + 0.1, 5)" title="Zoom in">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </button>
        <button class="lightbox-tool-btn" @click="lightbox.scale = Math.max(lightbox.scale - 0.1, 0.25)" title="Zoom out">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </button>
        <button class="lightbox-tool-btn" @click="lightbox.scale = 1; lightbox.panX = 0; lightbox.panY = 0" title="Fit to screen">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
        </button>
        <span class="lightbox-zoom-label">{{ Math.round(lightbox.scale * 100) }}%</span>
        <button class="lightbox-tool-btn lightbox-download-btn" @click="downloadImage" title="Download">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
      </div>
      <div class="lightbox-content">
        <video v-if="lightbox.items[lightbox.index]?.type === 'video' || lightbox.items[lightbox.index]?.type === 'animated_gif'" :src="lightbox.items[lightbox.index].videoUrl" controls autoplay :loop="lightbox.items[lightbox.index]?.type === 'animated_gif'" class="lightbox-video"></video>
        <img v-else
          :src="lightbox.items[lightbox.index]?.url"
          class="lightbox-image"
          :class="{ 'lightbox-draggable': lightbox.scale > 1 }"
          :style="{ transform: `scale(${lightbox.scale}) translate(${lightbox.panX}px, ${lightbox.panY}px)`, transition: lightbox.isDragging ? 'none' : 'transform 0.2s ease' }"
          @mousedown="startDrag"
          @mousemove="doDrag"
          @mouseup="endDrag"
          @mouseleave="endDrag"
        />
      </div>
    </div>

    <!-- Modals -->
    <ExportModal v-if="showExportModal" @close="showExportModal = false" @export="handleExport" />
    <ImportModal v-if="showImportModal" @close="showImportModal = false" @imported="handleImported" />
    <TagModal v-if="showTagModal" :tags="tags" @close="showTagModal = false" @create="createTag" @rename="renameTag" @delete="deleteTag" />
    <CollectionModal v-if="showCreateCollectionModal" @close="showCreateCollectionModal = false" @create="handleCreateCollection" />
    <CollectionManageModal v-if="showCollectionManageModal" :collections="collections" @close="showCollectionManageModal = false" @rename="handleRenameCollection" @delete="handleDeleteCollection" />
    <TagsBrowserModal v-if="showTagsBrowserModal" :tags="tags" :tagCounts="tagCounts" :currentView="currentView" @close="showTagsBrowserModal = false" @select="handleTagSelect" />
    <NoteModal v-if="showNoteModal" :initialNote="editingNote" @close="showNoteModal = false" @save="saveNote" />
    <ShareModal v-if="showShareModal" :content="shareContent" @close="showShareModal = false" @share="handleShare" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { Search, ArrowDown, ArrowUp } from 'lucide-vue-next'
import { getDB } from './db.js'

// Components
import AppSidebar from './components/layout/AppSidebar.vue'
import StatsView from './components/stats/StatsView.vue'
import TopTweetsView from './components/stats/TopTweetsView.vue'
import BookmarkItem from './components/bookmarks/BookmarkItem.vue'
import BulkActions from './components/bookmarks/BulkActions.vue'
import ExportModal from './components/modals/ExportModal.vue'
import ImportModal from './components/modals/ImportModal.vue'
import TagModal from './components/modals/TagModal.vue'
import CollectionModal from './components/modals/CollectionModal.vue'
import CollectionManageModal from './components/modals/CollectionManageModal.vue'
import TagsBrowserModal from './components/modals/TagsBrowserModal.vue'
import SettingsView from './components/settings/SettingsView.vue'
import NoteModal from './components/modals/NoteModal.vue'
import ShareModal from './components/modals/ShareModal.vue'

// Composables
import { useBookmarks } from './composables/useBookmarks.js'
import { useSync } from './composables/useSync.js'
import { useStats } from './composables/useStats.js'
import { useKeyboard } from './composables/useKeyboard.js'
import { useAI } from './composables/useAI.js'

// --- Bookmarks ---
const {
  bookmarks, tags, tagCounts, collections, total, selectedIds,
  loadingMore, searchQuery, showAdvancedSearch, currentView,
  openDropdownId, dropdownType, filters, sortOrder,
  loadBookmarks, loadMore, loadTags, loadTagCounts, loadCollections,
  addTag, removeTag, addToCollection, removeFromCollection,
  createTag, createCollection,
  deleteTag, renameTag,
  deleteBookmark, updateNote, toggleSelect, clearSelection,
  bulkTag, bulkAddToCollection, bulkExport,
  clearFilters, toggleDropdown, debouncedSearch, switchView, setSortOrder, initHashListener,
} = useBookmarks()

// --- Sync ---
const { syncState, syncMessage, startSync, dismissStatus, handleSyncMessage } = useSync()

// --- Stats ---
const { statsData, loadStatsData } = useStats()

// --- AI ---
const { aiConfig, aiProcessing, loadAIConfig, saveAIConfig, processSingleBookmark } = useAI()
const aiProcessingIds = ref(new Set())

// --- State ---
const stats = reactive({ bookmarkCount: 0 })
const scrollTrigger = ref(null)

// Modals
const showExportModal = ref(false)
const showImportModal = ref(false)
const showTagModal = ref(false)
const showCreateCollectionModal = ref(false)
const showCollectionManageModal = ref(false)
const showTagsBrowserModal = ref(false)
const showNoteModal = ref(false)
const showShareModal = ref(false)
const shareContent = ref('')

// Note editor
const editingBookmarkId = ref(null)
const editingNote = ref('')

// Lightbox
const lightbox = reactive({ visible: false, items: [], index: 0, scale: 1, panX: 0, panY: 0, isDragging: false, dragStartX: 0, dragStartY: 0 })

// --- Computed ---
const viewTitle = computed(() => {
  if (currentView.value === 'all') return 'All Bookmarks'
  if (currentView.value.startsWith('tag:')) return currentView.value.slice(4)
  if (currentView.value.startsWith('collection:')) {
    const col = collections.value.find(c => c.id === parseInt(currentView.value.slice(11)))
    return col?.name || 'Collection'
  }
  return 'Bookmarks'
})

// --- Keyboard ---
const { handleKeydown } = useKeyboard({
  bookmarks,
  selectedIds,
  toggleSelect,
  lightbox,
  closeLightbox,
  modals: [showExportModal, showImportModal, showTagModal, showShareModal, showNoteModal, showCreateCollectionModal, showCollectionManageModal, showTagsBrowserModal],
})

// --- Navigation ---
function handleNavigate(view) {
  switchView(view)
  if (view === 'stats' || view === 'rankings') loadStatsData()
}

function handleAction(action) {
  if (action === 'export') showExportModal.value = true
  else if (action === 'import') showImportModal.value = true
  else if (action === 'manageTags') showTagModal.value = true
  else if (action === 'settings') switchView('settings')
  else if (action === 'createCollection') showCreateCollectionModal.value = true
  else if (action === 'manageCollections') showCollectionManageModal.value = true
}

// --- Sync ---
function handleSync(fullSync) {
  startSync(fullSync, () => { loadBookmarks(); loadStats() })
}

function onSyncMessage(message) {
  handleSyncMessage(message, () => { loadBookmarks(); loadStats() })
  if (message.type === 'CONTEXT_MENU_ACTION') {
    if (message.action === 'addTag') {
      const name = prompt('Tag name to add:')
      if (name) {
        getDB().then(async db => {
          const existing = await db.tags.where('name').equals(name).first()
          if (!existing) await db.addTag(name)
          await db.addTagToBookmark(message.bookmarkId, name)
          loadBookmarks(); loadTags()
        })
      }
    }
  }
}

// --- Stats ---
async function loadStats() {
  const db = await getDB()
  stats.bookmarkCount = await db.getBookmarkCount()
}

// --- Media ---
function openMedia(bm, index) {
  const items = []
  const mediaUrls = bm.mediaUrls || []
  const mediaTypes = bm.mediaTypes || []
  const videoUrls = bm.videoUrls || []
  let videoIdx = 0
  for (let i = 0; i < mediaUrls.length; i++) {
    const type = mediaTypes[i] || 'photo'
    const thumbUrl = mediaUrls[i]
    let highResUrl = thumbUrl
    if (type === 'photo' && thumbUrl.includes('pbs.twimg.com')) {
      highResUrl = thumbUrl.split('?')[0] + '?format=jpg&name=4096x4096'
    }
    const item = { thumbnail: thumbUrl, type, url: highResUrl }
    if (type === 'video' || type === 'animated_gif') {
      item.videoUrl = videoUrls[videoIdx] || ''
      videoIdx++
    }
    items.push(item)
  }
  lightbox.items = items
  lightbox.index = index
  lightbox.visible = true
}

function closeLightbox() { lightbox.visible = false; lightbox.scale = 1; lightbox.panX = 0; lightbox.panY = 0 }

function handleLightboxWheel(e) {
  const delta = e.deltaY < 0 ? 0.05 : -0.05
  lightbox.scale = Math.min(Math.max(lightbox.scale + delta, 0.25), 5)
}

function startDrag(e) {
  if (lightbox.scale <= 1) return
  lightbox.isDragging = true
  lightbox.dragStartX = e.clientX - lightbox.panX * lightbox.scale
  lightbox.dragStartY = e.clientY - lightbox.panY * lightbox.scale
  e.preventDefault()
}

function doDrag(e) {
  if (!lightbox.isDragging) return
  lightbox.panX = (e.clientX - lightbox.dragStartX) / lightbox.scale
  lightbox.panY = (e.clientY - lightbox.dragStartY) / lightbox.scale
}

function endDrag() {
  lightbox.isDragging = false
}

async function downloadImage() {
  const item = lightbox.items[lightbox.index]
  if (!item?.url) return
  try {
    const res = await fetch(item.url)
    const blob = await res.blob()
    const name = lightboxDownloadName.value
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(a.href)
  } catch {
    // Fallback: open in new tab
    window.open(item.url, '_blank')
  }
}

const currentLightboxUrl = computed(() => {
  const item = lightbox.items[lightbox.index]
  return item?.url || ''
})

const lightboxDownloadName = computed(() => {
  const item = lightbox.items[lightbox.index]
  if (!item?.url) return 'image.jpg'
  const parts = item.url.split('/')
  return parts[parts.length - 1]?.split('?')[0] || 'image.jpg'
})

// --- Notes ---
function openNoteEditor(bm) {
  editingBookmarkId.value = bm.id
  editingNote.value = bm.notes || ''
  showNoteModal.value = true
}

async function saveNote(note) {
  if (editingBookmarkId.value) {
    await updateNote(editingBookmarkId.value, note)
  }
  showNoteModal.value = false
}

// --- Tag prompt ---
async function promptNewTag(bookmarkId) {
  const name = prompt('New tag name:')
  if (!name) return
  await createTag(name)
  await addTag(bookmarkId, name)
}

// --- Collection prompt ---
async function promptNewCollection(bookmarkId) {
  const name = prompt('New collection name:')
  if (!name) return
  await createCollection(name, '')
  // Find the newly created collection and add bookmark to it
  const db = await getDB()
  const allCols = await db.getAllCollections()
  const newCol = allCols.find(c => c.name === name)
  if (newCol) {
    await addToCollection(newCol.id, bookmarkId)
  }
}

// --- Collection ---
async function handleCreateCollection(name, desc) {
  await createCollection(name, desc)
  showCreateCollectionModal.value = false
}

function handleTagSelect(tagName) {
  switchView('tag:' + tagName)
}

async function handleRenameCollection(id, newName) {
  const db = await getDB()
  await db.updateCollection(id, { name: newName })
  await loadCollections()
}

async function handleDeleteCollection(id) {
  const db = await getDB()
  await db.deleteCollection(id)
  await loadCollections()
  if (currentView.value === 'collection:' + id) switchView('all')
}

// --- Delete ---
async function handleDelete(id) {
  if (!confirm('Delete this bookmark from local storage?')) return
  await deleteBookmark(id)
  await loadStats()
}

async function handleDeleteFromRankings(idOrTweetId) {
  const db = await getDB()
  // Try direct id first, then search by tweetId
  let bookmark = await db.bookmarks.get(idOrTweetId)
  if (!bookmark) {
    bookmark = await db.bookmarks.where('tweetId').equals(String(idOrTweetId)).first()
  }
  if (!bookmark) return
  await db.deleteBookmark(bookmark.id)
  await loadStats()
  await loadStatsData()
}

// --- Export ---
async function handleExport(format) {
  const db = await getDB()
  let content, filename, mimeType
  if (format === 'json') {
    content = JSON.stringify(await db.exportAsJSON(), null, 2)
    filename = 'xmark-bookmarks'; mimeType = 'application/json'
  } else if (format === 'csv') {
    content = await db.exportAsCSV()
    filename = 'xmark-bookmarks'; mimeType = 'text/csv'
  } else if (format === 'markdown') {
    content = await db.exportAsMarkdown()
    filename = 'xmark-bookmarks'; mimeType = 'text/markdown'
  }
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${filename}.${format === 'markdown' ? 'md' : format}`; a.click()
  URL.revokeObjectURL(url)
  showExportModal.value = false
}

async function handleImported(result) {
  await loadBookmarks()
  await loadTags()
  await loadTagCounts()
  await loadCollections()
  await loadStats()
}

async function handleBulkExport() {
  const data = await bulkExport()
  const headers = ['tweetId', 'text', 'authorName', 'authorHandle', 'url', 'createdAt', 'tags', 'notes', 'likes', 'retweets', 'replies']
  const escape = (str) => {
    if (!str) return ''
    const s = String(str).replace(/"/g, '""')
    return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s}"` : s
  }
  const rows = data.map(b => [
    escape(b.tweetId), escape(b.text), escape(b.authorName), escape(b.authorHandle),
    escape(b.tweetUrl), escape(b.createdAt),
    escape((b.tags || []).join('; ')), escape(b.notes),
    escape(b.likeCount), escape(b.retweetCount), escape(b.replyCount),
  ].join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'selected-bookmarks.csv'; a.click()
  URL.revokeObjectURL(url)
}

// --- Share ---
async function handleShare(format) {
  const bms = bookmarks.value
  let text
  if (format === 'text') {
    text = bms.map(b => `@${b.authorHandle}: ${b.text || ''}\n${b.tweetUrl}`).join('\n\n---\n\n')
  } else {
    text = bms.map(b => `**@${b.authorHandle}** (${b.authorName})\n\n${b.text || ''}\n\n[Open on X](${b.tweetUrl})`).join('\n\n---\n\n')
  }
  shareContent.value = text
  navigator.clipboard.writeText(text).catch(() => {})
}

// --- AI ---
async function handleAIProcess(bookmarkId) {
  aiProcessingIds.value.add(bookmarkId)
  try {
    await processSingleBookmark(bookmarkId)
    await loadBookmarks()
    await loadTags()
    await loadTagCounts()
    await loadCollections()
  } catch (e) {
    console.error('[AI] Process failed:', e.message)
  } finally {
    aiProcessingIds.value.delete(bookmarkId)
    aiProcessingIds.value = new Set(aiProcessingIds.value) // trigger reactivity
  }
}

async function handleSaveAIConfig(config) {
  await saveAIConfig(config)
}

// --- Infinite scroll ---
let scrollObserver = null
function setupScrollObserver() {
  if (scrollObserver) scrollObserver.disconnect()
  scrollObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) loadMore()
  }, { rootMargin: '200px' })
}

watch(scrollTrigger, (el) => {
  if (el && scrollObserver) scrollObserver.observe(el)
}, { flush: 'post' })

// --- Click outside ---
function handleClickOutside(e) {
  if (openDropdownId.value && !e.target.closest('.category-dropdown')) openDropdownId.value = null
}

// --- Lifecycle ---
onMounted(() => {
  if (currentView.value === 'stats' || currentView.value === 'rankings') loadStatsData()
  else loadBookmarks()
  loadTags(); loadTagCounts(); loadCollections(); loadStats(); loadAIConfig()
  initHashListener(loadStatsData)
  chrome.runtime.onMessage.addListener(onSyncMessage)
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
  setupScrollObserver()
})

onUnmounted(() => {
  chrome.runtime.onMessage.removeListener(onSyncMessage)
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
  if (scrollObserver) scrollObserver.disconnect()
})
</script>

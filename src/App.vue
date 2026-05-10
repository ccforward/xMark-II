<template>
  <div class="app-layout">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-brand">XB Sync</div>

      <div class="sidebar-section-title">View</div>
      <div class="sidebar-item" :class="{ active: activeCategory === 'all' }" @click="activeCategory = 'all'">
        <span>📋</span><span>All Bookmarks</span>
        <span class="count">{{ stats.bookmarkCount }}</span>
      </div>
      <div class="sidebar-item" :class="{ active: activeCategory === 'uncategorized' }" @click="activeCategory = 'uncategorized'">
        <span>📭</span><span>Uncategorized</span>
      </div>

      <div class="sidebar-section-title">Categories</div>
      <div
        v-for="cat in categories"
        :key="cat.name"
        class="sidebar-item"
        :class="{ active: activeCategory === cat.name }"
        @click="activeCategory = cat.name"
      >
        <span class="category-dot" :style="{ background: cat.color }"></span>
        <span>{{ cat.name }}</span>
      </div>

      <div class="sidebar-section-title" style="margin-top:auto">Actions</div>
      <div class="sidebar-item" @click="showExportModal = true">
        <span>📤</span><span>Export</span>
      </div>
      <div class="sidebar-item" @click="showCategoryModal = true">
        <span>🏷️</span><span>Manage Categories</span>
      </div>
      <div class="sidebar-item" @click="handleLoadMockData">
        <span>🧪</span><span>Load Mock Data</span>
      </div>
      <div class="sidebar-item" @click="handleRunDBTests">
        <span>✅</span><span>Run DB Tests</span>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Header -->
      <div class="page-header">
        <h1 class="page-title">
          {{ activeCategory === 'all' ? 'All Bookmarks' :
             activeCategory === 'uncategorized' ? 'Uncategorized' :
             activeCategory }}
        </h1>
        <div class="header-actions">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input v-model="searchQuery" placeholder="Search bookmarks..." @input="debouncedSearch" />
          </div>
          <button class="btn btn-primary" :disabled="syncState === 'syncing'" @click="startSync(false)">
            <span v-if="syncState === 'syncing'" class="spinner"></span>
            {{ syncState === 'syncing' ? 'Syncing...' : 'Sync' }}
          </button>
          <button class="btn btn-secondary" :disabled="syncState === 'syncing'" @click="startSync(true)">Full Sync</button>
        </div>
      </div>

      <!-- Sync Status -->
      <div v-if="syncMessage" class="sync-status" :class="syncState">
        <span style="flex:1;white-space:pre-wrap">{{ syncMessage }}</span>
        <button v-if="syncState !== 'syncing'" class="icon-btn" style="color:inherit;font-size:16px" @click="dismissStatus">×</button>
      </div>

      <!-- Bulk Actions -->
      <div v-if="selectedIds.size > 0" class="bulk-actions">
        <span class="count">{{ selectedIds.size }} selected</span>
        <button class="btn btn-sm" style="background:rgba(255,255,255,0.2);color:white" @click="bulkCategorize">Categorize</button>
        <button class="btn btn-sm" style="background:rgba(255,255,255,0.2);color:white" @click="bulkExport">Export Selected</button>
        <button class="btn btn-sm" style="background:rgba(255,255,255,0.2);color:white" @click="clearSelection">Deselect</button>
      </div>

      <!-- Bookmark List -->
      <div v-if="bookmarks.length > 0" class="bookmark-list">
        <div v-for="bm in bookmarks" :key="bm.id" class="bookmark-item">
          <div class="bookmark-checkbox" :class="{ checked: selectedIds.has(bm.id) }">
            <input type="checkbox" :checked="selectedIds.has(bm.id)" @change="toggleSelect(bm.id)" />
          </div>
          <a :href="'https://x.com/' + (bm.authorHandle || '_')" target="_blank" class="avatar-link">
            <img v-if="bm.authorAvatarUrl" :src="bm.authorAvatarUrl" class="bookmark-avatar" loading="lazy" />
            <div v-else class="bookmark-avatar placeholder-avatar">{{ (bm.authorName || '?')[0] }}</div>
          </a>
          <div class="bookmark-body">
            <div class="bookmark-header">
              <a :href="'https://x.com/' + (bm.authorHandle || '_')" target="_blank" class="bookmark-author">{{ bm.authorName || 'Unknown' }}</a>
              <a :href="'https://x.com/' + (bm.authorHandle || '_')" target="_blank" class="bookmark-handle">@{{ bm.authorHandle || '?' }}</a>
              <span class="bookmark-date-sep">·</span>
              <a :href="bm.tweetUrl" target="_blank" class="bookmark-date">{{ formatDate(bm.bookmarkedAt || bm.createdAt) }}</a>
            </div>

            <!-- Tweet text (clickable to open on X) -->
            <a :href="bm.tweetUrl" target="_blank" class="bookmark-text-link">
              <div v-if="bm.noteText" class="bookmark-text note-text">
                <span class="note-badge">Article</span>
                {{ truncateText(bm.noteText, 500) }}
              </div>
              <div v-else-if="bm.text" class="bookmark-text">{{ bm.text }}</div>
              <div v-else class="bookmark-text empty-text">[No text content]</div>
            </a>

            <!-- Media -->
            <div v-if="getMediaItems(bm).length" class="bookmark-media" :class="'media-count-' + Math.min(getMediaItems(bm).length, 4)">
              <div
                v-for="(media, i) in getMediaItems(bm).slice(0, 4)"
                :key="i"
                class="media-item"
                @click="openMedia(bm, i)"
              >
                <img :src="media.thumbnail" loading="lazy" />
                <div v-if="media.type === 'video'" class="video-badge">▶</div>
                <div v-if="media.type === 'animated_gif'" class="video-badge">GIF</div>
              </div>
            </div>

            <!-- External URLs -->
            <div v-if="bm.urls?.length" class="bookmark-urls">
              <a v-for="(url, i) in bm.urls.slice(0, 3)" :key="i" :href="url" target="_blank" class="external-url">
                🔗 {{ shortenUrl(url) }}
              </a>
            </div>

            <!-- Stats -->
            <div class="bookmark-stats">
              <span v-if="bm.replyCount" title="Replies">💬 {{ formatNum(bm.replyCount) }}</span>
              <span v-if="bm.retweetCount" title="Reposts">🔁 {{ formatNum(bm.retweetCount) }}</span>
              <span v-if="bm.likeCount" title="Likes">❤️ {{ formatNum(bm.likeCount) }}</span>
              <span v-if="bm.viewCount" title="Views">👁️ {{ formatNum(bm.viewCount) }}</span>
              <span v-if="bm.bookmarkCount" title="Bookmarks">🔖 {{ formatNum(bm.bookmarkCount) }}</span>
            </div>

            <!-- Notes -->
            <div v-if="bm.notes" class="bookmark-notes">
              <span class="notes-label">Note:</span> {{ bm.notes }}
            </div>

            <!-- Footer: categories + actions -->
            <div class="bookmark-footer">
              <div class="bookmark-categories">
                <span v-for="cat in (bm.categories || [])" :key="cat" class="category-tag" :style="getCategoryStyle(cat)">
                  {{ cat }}
                  <button class="tag-remove" @click="removeCategory(bm.id, cat)">×</button>
                </span>
              </div>
              <div class="bookmark-actions">
                <div class="category-dropdown">
                  <button class="icon-btn" title="Add category" @click="toggleDropdown(bm.id)">🏷️</button>
                  <div v-if="openDropdownId === bm.id" class="category-dropdown-menu">
                    <div
                      v-for="cat in categories"
                      :key="cat.name"
                      class="category-dropdown-item"
                      :class="{ assigned: bm.categories?.includes(cat.name) }"
                      @click="addCategory(bm.id, cat.name)"
                    >
                      <span class="category-dot" :style="{ background: cat.color }"></span>
                      {{ cat.name }}
                    </div>
                    <div class="category-dropdown-item" @click="promptNewCategory(bm.id)">+ New category...</div>
                  </div>
                </div>
                <button class="icon-btn" title="Add note" @click="editNote(bm)">📝</button>
                <a :href="bm.tweetUrl" target="_blank" class="icon-btn" title="Open on X">↗</a>
                <button class="icon-btn" title="Delete" @click="deleteBookmark(bm.id)">🗑️</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <h3>No bookmarks yet</h3>
        <p>Click "Sync" to start importing your X bookmarks</p>
      </div>

      <!-- Load More (infinite scroll trigger) -->
      <div v-if="bookmarks.length < total" ref="scrollTrigger" class="load-more">
        <span class="spinner"></span> Loading more...
      </div>
      <div v-else-if="bookmarks.length > 0" class="load-more-end">
        All {{ total }} bookmarks loaded
      </div>
    </main>

    <!-- Media Lightbox -->
    <div v-if="lightbox.visible" class="lightbox-overlay" @click.self="closeLightbox">
      <button class="lightbox-close" @click="closeLightbox">×</button>
      <button v-if="lightbox.items.length > 1 && lightbox.index > 0" class="lightbox-nav lightbox-prev" @click="lightbox.index--">‹</button>
      <button v-if="lightbox.items.length > 1 && lightbox.index < lightbox.items.length - 1" class="lightbox-nav lightbox-next" @click="lightbox.index++">›</button>
      <div class="lightbox-content">
        <video
          v-if="lightbox.items[lightbox.index]?.type === 'video' || lightbox.items[lightbox.index]?.type === 'animated_gif'"
          :src="lightbox.items[lightbox.index].videoUrl"
          controls
          autoplay
          :loop="lightbox.items[lightbox.index]?.type === 'animated_gif'"
          class="lightbox-video"
        ></video>
        <img v-else :src="lightbox.items[lightbox.index]?.url" class="lightbox-image" />
      </div>
    </div>

    <!-- Export Modal -->
    <div v-if="showExportModal" class="modal-overlay" @click.self="showExportModal = false">
      <div class="modal">
        <h2 class="modal-title">Export Bookmarks</h2>
        <p style="color:var(--text-secondary);margin-bottom:16px;font-size:14px">
          Choose a format. JSON is best for AI processing and re-importing.
        </p>
        <div class="export-options">
          <button class="btn btn-primary" @click="exportData('json')">JSON</button>
          <button class="btn btn-secondary" @click="exportData('csv')">CSV</button>
          <button class="btn btn-secondary" @click="exportData('markdown')">Markdown</button>
        </div>
        <div class="form-group" style="margin-top:16px">
          <label class="form-label">Category filter</label>
          <select v-model="exportCategory" class="form-input">
            <option value="all">All categories</option>
            <option value="uncategorized">Uncategorized only</option>
            <option v-for="cat in categories" :key="cat.name" :value="cat.name">{{ cat.name }}</option>
          </select>
        </div>
        <button class="btn btn-secondary" style="margin-top:12px" @click="showExportModal = false">Cancel</button>
      </div>
    </div>

    <!-- Category Manager Modal -->
    <div v-if="showCategoryModal" class="modal-overlay" @click.self="showCategoryModal = false">
      <div class="modal">
        <h2 class="modal-title">Manage Categories</h2>
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <input v-model="newCategoryName" class="form-input" placeholder="New category name..." @keyup.enter="createCategory" />
          <button class="btn btn-primary btn-sm" @click="createCategory">Add</button>
        </div>
        <div class="category-list">
          <div v-for="cat in categories" :key="cat.name" class="category-list-item">
            <span class="category-dot" :style="{ background: cat.color }"></span>
            <span class="name">{{ cat.name }}</span>
            <div class="actions">
              <button class="icon-btn" title="Rename" @click="renameCategoryPrompt(cat.name)">✏️</button>
              <button class="icon-btn" title="Delete" @click="deleteCategoryConfirm(cat.name)">🗑️</button>
            </div>
          </div>
          <div v-if="categories.length === 0" style="color:var(--text-muted);text-align:center;padding:20px">
            No categories yet. Create one above.
          </div>
        </div>
        <button class="btn btn-secondary" style="margin-top:16px" @click="showCategoryModal = false">Close</button>
      </div>
    </div>

    <!-- Note Editor Modal -->
    <div v-if="showNoteModal" class="modal-overlay" @click.self="closeNoteModal">
      <div class="modal">
        <h2 class="modal-title">Edit Note</h2>
        <textarea v-model="editingNote" class="form-input" rows="4" placeholder="Add a note for this bookmark..."></textarea>
        <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end">
          <button class="btn btn-secondary" @click="closeNoteModal">Cancel</button>
          <button class="btn btn-primary" @click="saveNote">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted, onUnmounted } from 'vue'
import { getDB, loadMockData, runDBTests } from './db.js'

// --- State ---
const bookmarks = ref([])
const categories = ref([])
const stats = reactive({ bookmarkCount: 0, lastSyncTime: null })
const activeCategory = ref('all')
const searchQuery = ref('')
const syncState = ref('idle')
const syncMessage = ref('')
const total = ref(0)
const selectedIds = ref(new Set())
const openDropdownId = ref(null)
const scrollTrigger = ref(null)
const loadingMore = ref(false)
const pageSize = 50

// Modals
const showExportModal = ref(false)
const showCategoryModal = ref(false)
const showNoteModal = ref(false)
const exportCategory = ref('all')

// Category manager
const newCategoryName = ref('')

// Note editor
const editingBookmarkId = ref(null)
const editingNote = ref('')

// Lightbox
const lightbox = reactive({ visible: false, items: [], index: 0 })

// Search debounce
let searchTimer = null
function debouncedSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { loadBookmarks() }, 300)
}

// --- Formatting ---
function formatNum(n) {
  if (!n) return '0'
  n = parseInt(n)
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  let hours = d.getHours()
  const minutes = d.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'pm' : 'am'
  hours = hours % 12 || 12
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${hours}:${minutes} ${ampm} · ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

function truncateText(text, maxLen) {
  if (!text) return ''
  if (text.length <= maxLen) return text
  return text.substring(0, maxLen) + '...'
}

function shortenUrl(url) {
  try {
    const u = new URL(url)
    let path = u.pathname + u.search
    if (path.length > 40) path = path.substring(0, 37) + '...'
    return u.hostname + path
  } catch { return url.substring(0, 50) }
}

// --- Media helpers ---
function getMediaItems(bm) {
  const items = []
  const mediaUrls = bm.mediaUrls || []
  const mediaTypes = bm.mediaTypes || []
  const videoUrls = bm.videoUrls || []
  let videoIdx = 0

  for (let i = 0; i < mediaUrls.length; i++) {
    const type = mediaTypes[i] || 'photo'
    const thumbUrl = mediaUrls[i]
    // Build high-res URL for lightbox
    let highResUrl = thumbUrl
    if (type === 'photo' && thumbUrl.includes('pbs.twimg.com')) {
      // Use original quality: ?format=jpg&name=4096x4096
      const base = thumbUrl.split('?')[0]
      highResUrl = base + '?format=jpg&name=4096x4096'
    }
    const item = { thumbnail: thumbUrl, type, url: highResUrl }
    if (type === 'video' || type === 'animated_gif') {
      item.videoUrl = videoUrls[videoIdx] || ''
      videoIdx++
    }
    items.push(item)
  }
  return items
}

function openMedia(bm, index) {
  lightbox.items = getMediaItems(bm)
  lightbox.index = index
  lightbox.visible = true
}

function closeLightbox() {
  lightbox.visible = false
}

// --- Data loading ---
async function loadBookmarks() {
  const db = await getDB()
  const result = await db.getBookmarks({
    offset: 0,
    limit: pageSize,
    category: activeCategory.value,
    search: searchQuery.value || null,
    sort: 'bookmarkedAt',
    order: 'desc',
  })
  bookmarks.value = result.results
  total.value = result.total
}

async function loadMore() {
  if (loadingMore.value || bookmarks.value.length >= total.value) return
  loadingMore.value = true
  const db = await getDB()
  const result = await db.getBookmarks({
    offset: bookmarks.value.length,
    limit: pageSize,
    category: activeCategory.value,
    search: searchQuery.value || null,
    sort: 'bookmarkedAt',
    order: 'desc',
  })
  bookmarks.value = [...bookmarks.value, ...result.results]
  total.value = result.total
  loadingMore.value = false
}

async function loadCategories() {
  const db = await getDB()
  categories.value = await db.getAllCategories()
}

async function loadStats() {
  const db = await getDB()
  stats.bookmarkCount = await db.getBookmarkCount()
  stats.lastSyncTime = await db.getSyncState('lastSyncTime')
}

// --- Sync ---
function startSync(fullSync) {
  syncState.value = 'syncing'
  syncMessage.value = fullSync ? 'Starting full sync...' : 'Starting incremental sync...'
  chrome.runtime.sendMessage({ type: 'START_SYNC', fullSync }, (response) => {
    if (chrome.runtime.lastError) {
      syncState.value = 'error'
      syncMessage.value = chrome.runtime.lastError.message
      return
    }
    if (response?.status === 'completed') {
      syncState.value = 'completed'
      syncMessage.value = `Sync complete. ${response.newCount} new bookmarks.`
      loadBookmarks()
      loadStats()
    } else if (response?.status === 'error') {
      syncState.value = 'error'
      syncMessage.value = response.message
    }
  })
}

function dismissStatus() { syncState.value = 'idle'; syncMessage.value = '' }

function handleSyncMessage(message) {
  if (message.type === 'SYNC_STATUS_UPDATE') {
    syncState.value = message.state
    syncMessage.value = message.message
    if (message.state === 'completed') { loadBookmarks(); loadStats() }
  }
}

// --- Category operations ---
function getCategoryStyle(catName) {
  const cat = categories.value.find(c => c.name === catName)
  if (cat) return { color: cat.color, borderColor: cat.color, background: cat.color + '20' }
  return { color: 'var(--text-secondary)', borderColor: 'var(--border)', background: 'transparent' }
}

async function addCategory(bookmarkId, catName) {
  const db = await getDB()
  await db.addCategoryToBookmark(bookmarkId, catName)
  openDropdownId.value = null
  await loadBookmarks()
}

async function removeCategory(bookmarkId, catName) {
  const db = await getDB()
  await db.removeCategoryFromBookmark(bookmarkId, catName)
  await loadBookmarks()
}

async function createCategory() {
  const name = newCategoryName.value.trim()
  if (!name) return
  try {
    const db = await getDB()
    await db.addCategory(name)
    newCategoryName.value = ''
    await loadCategories()
  } catch (e) {
    if (e.name === 'ConstraintError') alert('Category already exists')
  }
}

async function deleteCategoryConfirm(name) {
  if (!confirm(`Delete category "${name}"? It will be removed from all bookmarks.`)) return
  const db = await getDB()
  await db.deleteCategory(name)
  if (activeCategory.value === name) activeCategory.value = 'all'
  await loadCategories()
  await loadBookmarks()
}

function renameCategoryPrompt(name) {
  const newName = prompt('New category name:', name)
  if (!newName || newName === name) return
  getDB().then(db => db.renameCategory(name, newName)).then(() => {
    if (activeCategory.value === name) activeCategory.value = newName
    loadCategories(); loadBookmarks()
  })
}

function toggleDropdown(id) { openDropdownId.value = openDropdownId.value === id ? null : id }

async function promptNewCategory(bookmarkId) {
  const name = prompt('New category name:')
  if (!name) return
  const db = await getDB()
  await db.addCategory(name)
  await db.addCategoryToBookmark(bookmarkId, name)
  openDropdownId.value = null
  await loadCategories()
  await loadBookmarks()
}

// --- Note operations ---
function editNote(bookmark) {
  editingBookmarkId.value = bookmark.id
  editingNote.value = bookmark.notes || ''
  showNoteModal.value = true
}

function closeNoteModal() { showNoteModal.value = false; editingBookmarkId.value = null; editingNote.value = '' }

async function saveNote() {
  if (editingBookmarkId.value) {
    const db = await getDB()
    await db.bookmarks.update(editingBookmarkId.value, { notes: editingNote.value })
    await loadBookmarks()
  }
  closeNoteModal()
}

// --- Selection ---
function toggleSelect(id) {
  const s = new Set(selectedIds.value)
  if (s.has(id)) s.delete(id); else s.add(id)
  selectedIds.value = s
}

function clearSelection() { selectedIds.value = new Set() }

async function bulkCategorize() {
  const catName = prompt('Category name to assign:')
  if (!catName) return
  const db = await getDB()
  if (!categories.value.find(c => c.name === catName)) {
    await db.addCategory(catName)
    await loadCategories()
  }
  for (const id of selectedIds.value) await db.addCategoryToBookmark(id, catName)
  await loadBookmarks()
  clearSelection()
}

async function bulkExport() {
  const db = await getDB()
  const data = []
  for (const id of selectedIds.value) { const bm = await db.bookmarks.get(id); if (bm) data.push(bm) }
  downloadJSON(data, 'selected-bookmarks')
}

// --- Export ---
async function exportData(format) {
  const db = await getDB()
  const cat = exportCategory.value
  let content, filename, mimeType
  if (format === 'json') {
    content = JSON.stringify(await db.exportAsJSON({ category: cat }), null, 2)
    filename = `x-bookmarks-${cat === 'all' ? 'all' : cat}`; mimeType = 'application/json'
  } else if (format === 'csv') {
    content = await db.exportAsCSV({ category: cat })
    filename = `x-bookmarks-${cat === 'all' ? 'all' : cat}`; mimeType = 'text/csv'
  } else if (format === 'markdown') {
    content = await db.exportAsMarkdown({ category: cat })
    filename = `x-bookmarks-${cat === 'all' ? 'all' : cat}`; mimeType = 'text/markdown'
  }
  downloadFile(content, filename, format, mimeType)
  showExportModal.value = false
}

function downloadJSON(data, name) { downloadFile(JSON.stringify(data, null, 2), name, 'json', 'application/json') }

function downloadFile(content, name, ext, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `${name}.${ext}`; a.click()
  URL.revokeObjectURL(url)
}

// --- Delete ---
async function deleteBookmark(id) {
  if (!confirm('Delete this bookmark from local storage?')) return
  const db = await getDB()
  await db.deleteBookmark(id)
  await loadBookmarks(); await loadStats()
}

// --- Mock Data & Testing ---
async function handleLoadMockData() {
  try {
    syncState.value = 'syncing'; syncMessage.value = 'Loading mock data...'
    const result = await loadMockData(10)
    syncState.value = 'completed'
    syncMessage.value = `Mock data loaded! ${result.count} bookmarks in DB.`
    await loadBookmarks(); await loadCategories(); await loadStats()
  } catch (e) { syncState.value = 'error'; syncMessage.value = `Mock data error: ${e.message}` }
}

async function handleRunDBTests() {
  try {
    syncState.value = 'syncing'; syncMessage.value = 'Running DB tests...'
    const { passed, total, results } = await runDBTests()
    if (passed === total) { syncState.value = 'completed'; syncMessage.value = `All ${total} DB tests passed!` }
    else { syncState.value = 'error'; syncMessage.value = `DB tests: ${passed}/${total} passed. Failed: ${results.filter(r => !r.pass).map(r => r.test).join(', ')}` }
    await loadBookmarks(); await loadCategories(); await loadStats()
  } catch (e) { syncState.value = 'error'; syncMessage.value = `DB test error: ${e.message}` }
}

// --- Keyboard shortcuts ---
function handleKeydown(e) {
  if (lightbox.visible) {
    if (e.key === 'Escape') closeLightbox()
    if (e.key === 'ArrowLeft' && lightbox.index > 0) lightbox.index--
    if (e.key === 'ArrowRight' && lightbox.index < lightbox.items.length - 1) lightbox.index++
  }
}

// --- Watchers ---
watch(activeCategory, () => { loadBookmarks() })

function handleClickOutside(e) {
  if (openDropdownId.value && !e.target.closest('.category-dropdown')) openDropdownId.value = null
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

// --- Lifecycle ---
onMounted(() => {
  loadBookmarks(); loadCategories(); loadStats()
  chrome.runtime.onMessage.addListener(handleSyncMessage)
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
  setupScrollObserver()
})

onUnmounted(() => {
  chrome.runtime.onMessage.removeListener(handleSyncMessage)
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
  if (scrollObserver) scrollObserver.disconnect()
})
</script>

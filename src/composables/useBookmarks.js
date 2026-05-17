import { ref, reactive } from 'vue'
import { getDB } from '../db.js'

const bookmarks = ref([])
const categories = ref([])
const tags = ref([])
const tagCounts = ref({})
const collections = ref([])
const total = ref(0)
const selectedIds = ref(new Set())
const loadingMore = ref(false)
const searchQuery = ref('')
const showAdvancedSearch = ref(false)
const currentView = ref(decodeURIComponent(location.hash.slice(1)) || 'all')
const openDropdownId = ref(null)
const dropdownType = ref('cat')
const filters = reactive({ author: '', dateFrom: '', dateTo: '', mediaType: '' })
const sortOrder = ref('desc')

const pageSize = 50

export function useBookmarks() {
  async function loadBookmarks() {
    const db = await getDB()
    const params = {
      offset: 0,
      limit: pageSize,
      sort: 'bookmarkedAt',
      order: sortOrder.value,
      search: searchQuery.value || null,
      author: filters.author || null,
      dateFrom: filters.dateFrom || null,
      dateTo: filters.dateTo || null,
      hasMedia: filters.mediaType === 'media' ? true : null,
      hasVideo: filters.mediaType === 'video' ? true : null,
    }

    if (currentView.value === 'uncategorized') params.category = 'uncategorized'
    else if (currentView.value.startsWith('category:')) params.category = currentView.value.slice(9)
    else if (currentView.value.startsWith('tag:')) params.tag = currentView.value.slice(4)
    else if (currentView.value.startsWith('collection:')) params.collectionId = parseInt(currentView.value.slice(11))

    const result = await db.getBookmarks(params)
    bookmarks.value = result.results
    total.value = result.total
  }

  async function loadMore() {
    if (loadingMore.value || bookmarks.value.length >= total.value) return
    loadingMore.value = true
    const db = await getDB()
    const params = {
      offset: bookmarks.value.length,
      limit: pageSize,
      sort: 'bookmarkedAt',
      order: sortOrder.value,
      search: searchQuery.value || null,
      author: filters.author || null,
      dateFrom: filters.dateFrom || null,
      dateTo: filters.dateTo || null,
      hasMedia: filters.mediaType === 'media' ? true : null,
      hasVideo: filters.mediaType === 'video' ? true : null,
    }

    if (currentView.value === 'uncategorized') params.category = 'uncategorized'
    else if (currentView.value.startsWith('category:')) params.category = currentView.value.slice(9)
    else if (currentView.value.startsWith('tag:')) params.tag = currentView.value.slice(4)
    else if (currentView.value.startsWith('collection:')) params.collectionId = parseInt(currentView.value.slice(11))

    const result = await db.getBookmarks(params)
    bookmarks.value = [...bookmarks.value, ...result.results]
    total.value = result.total
    loadingMore.value = false
  }

  function setSortOrder(order) {
    sortOrder.value = order
    loadBookmarks()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function loadCategories() {
    const db = await getDB()
    categories.value = await db.getAllCategories()
  }

  async function loadTags() {
    const db = await getDB()
    tags.value = await db.getAllTags()
  }

  async function loadTagCounts() {
    const db = await getDB()
    tagCounts.value = await db.getTagCounts()
  }

  async function loadCollections() {
    const db = await getDB()
    collections.value = await db.getAllCollections()
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

  async function addTag(bookmarkId, tagName) {
    const db = await getDB()
    await db.addTagToBookmark(bookmarkId, tagName)
    openDropdownId.value = null
    await loadBookmarks()
    await loadTagCounts()
  }

  async function removeTag(bookmarkId, tagName) {
    const db = await getDB()
    await db.removeTagFromBookmark(bookmarkId, tagName)
    await loadBookmarks()
    await loadTagCounts()
  }

  async function addToCollection(collectionId, bookmarkId) {
    const db = await getDB()
    await db.addBookmarkToCollection(collectionId, bookmarkId)
    openDropdownId.value = null
    await loadCollections()
  }

  async function removeFromCollection(collectionId, bookmarkId) {
    const db = await getDB()
    await db.removeBookmarkFromCollection(collectionId, bookmarkId)
    await loadCollections()
    // If viewing this collection, reload to reflect removal
    if (currentView.value === 'collection:' + collectionId) await loadBookmarks()
  }

  async function createCategory(name) {
    if (!name) return
    const db = await getDB()
    await db.addCategory(name)
    await loadCategories()
  }

  async function createTag(name) {
    if (!name) return
    const db = await getDB()
    await db.addTag(name)
    await loadTags()
  }

  async function createCollection(name, desc) {
    if (!name) return
    const db = await getDB()
    await db.createCollection(name, desc)
    await loadCollections()
  }

  async function deleteCategory(name) {
    const db = await getDB()
    await db.deleteCategory(name)
    if (currentView.value === 'category:' + name) currentView.value = 'all'
    await loadCategories()
    await loadBookmarks()
  }

  async function deleteTag(name) {
    const db = await getDB()
    await db.deleteTag(name)
    if (currentView.value === 'tag:' + name) currentView.value = 'all'
    await loadTags()
    await loadTagCounts()
    await loadBookmarks()
  }

  async function renameCategory(oldName, newName) {
    const db = await getDB()
    await db.renameCategory(oldName, newName)
    await loadCategories()
    await loadBookmarks()
  }

  async function renameTag(oldName, newName) {
    const db = await getDB()
    await db.renameTag(oldName, newName)
    await loadTags()
    await loadTagCounts()
    await loadBookmarks()
  }

  async function deleteBookmark(id) {
    const db = await getDB()
    await db.deleteBookmark(id)
    await loadBookmarks()
  }

  async function updateNote(bookmarkId, note) {
    const db = await getDB()
    await db.bookmarks.update(bookmarkId, { notes: note })
    await loadBookmarks()
  }

  function toggleSelect(id) {
    const s = new Set(selectedIds.value)
    if (s.has(id)) s.delete(id); else s.add(id)
    selectedIds.value = s
  }

  function clearSelection() { selectedIds.value = new Set() }

  async function bulkCategorize(catName) {
    const db = await getDB()
    if (!categories.value.find(c => c.name === catName)) {
      await db.addCategory(catName)
      await loadCategories()
    }
    for (const id of selectedIds.value) await db.addCategoryToBookmark(id, catName)
    await loadBookmarks()
    clearSelection()
  }

  async function bulkTag(tagName) {
    const db = await getDB()
    if (!tags.value.find(t => t.name === tagName)) {
      await db.addTag(tagName)
      await loadTags()
    }
    for (const id of selectedIds.value) await db.addTagToBookmark(id, tagName)
    await loadBookmarks()
    await loadTagCounts()
    clearSelection()
  }

  async function bulkAddToCollection(colId) {
    const db = await getDB()
    for (const id of selectedIds.value) await db.addBookmarkToCollection(colId, id)
    await loadCollections()
    clearSelection()
  }

  async function bulkExport() {
    const db = await getDB()
    const data = []
    for (const id of selectedIds.value) {
      const bm = await db.bookmarks.get(id)
      if (bm) data.push(bm)
    }
    return data
  }

  function clearFilters() {
    filters.author = ''
    filters.dateFrom = ''
    filters.dateTo = ''
    filters.mediaType = ''
    loadBookmarks()
  }

  function toggleDropdown(id, type) {
    if (openDropdownId.value === id && dropdownType.value === type) {
      openDropdownId.value = null
    } else {
      openDropdownId.value = id
      dropdownType.value = type
    }
  }

  let searchTimer = null
  function debouncedSearch() {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => loadBookmarks(), 300)
  }

  function switchView(view) {
    currentView.value = view
    location.hash = view
    // Clear search when switching views
    searchQuery.value = ''
    filters.author = ''
    filters.dateFrom = ''
    filters.dateTo = ''
    filters.mediaType = ''
    if (view !== 'stats' && view !== 'rankings' && view !== 'settings') loadBookmarks()
  }

  function initHashListener(onStats) {
    window.addEventListener('hashchange', () => {
      const hash = decodeURIComponent(location.hash.slice(1)) || 'all'
      if (hash !== currentView.value) {
        currentView.value = hash
        if (hash === 'stats' || hash === 'rankings') { onStats() }
        else if (hash !== 'settings') { loadBookmarks() }
      }
    })
  }

  return {
    bookmarks,
    categories,
    tags,
    tagCounts,
    collections,
    total,
    selectedIds,
    loadingMore,
    searchQuery,
    showAdvancedSearch,
    currentView,
    openDropdownId,
    dropdownType,
    filters,
    sortOrder,
    loadBookmarks,
    loadMore,
    loadCategories,
    loadTags,
    loadTagCounts,
    loadCollections,
    addCategory,
    removeCategory,
    addTag,
    removeTag,
    addToCollection,
    removeFromCollection,
    createCategory,
    createTag,
    createCollection,
    deleteCategory,
    deleteTag,
    renameCategory,
    renameTag,
    deleteBookmark,
    updateNote,
    toggleSelect,
    clearSelection,
    bulkCategorize,
    bulkTag,
    bulkAddToCollection,
    bulkExport,
    clearFilters,
    toggleDropdown,
    debouncedSearch,
    switchView,
    setSortOrder,
    initHashListener,
  }
}

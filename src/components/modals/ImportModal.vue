<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal" style="max-width:440px">
      <h2 class="modal-title">Import Bookmarks</h2>
      <p style="color:var(--text-secondary);margin-bottom:16px;font-size:14px">Select a JSON file exported from xMark.</p>

      <div class="form-group">
        <label class="form-label">File</label>
        <input ref="fileInput" type="file" accept=".json" class="form-input" @change="onFileSelect" />
      </div>

      <div v-if="previewCount !== null" class="import-preview">
        <div class="import-preview-row">
          <span>Bookmarks in file:</span>
          <span class="import-preview-value">{{ previewCount }}</span>
        </div>
        <div class="import-preview-row">
          <span>Already in DB:</span>
          <span class="import-preview-value">{{ existingCount }}</span>
        </div>
        <div class="import-preview-row">
          <span>Will be imported:</span>
          <span class="import-preview-value highlight">{{ previewCount - existingCount }}</span>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Duplicate handling</label>
        <select v-model="onConflict" class="form-input">
          <option value="skip">Skip existing (keep current data)</option>
          <option value="overwrite">Overwrite existing</option>
        </select>
      </div>

      <div v-if="importResult" class="import-result">
        <div class="import-result-row"><span>Imported:</span><span class="import-result-value success">{{ importResult.bookmarks }}</span></div>
        <div v-if="importResult.categories > 0" class="import-result-row"><span>New categories:</span><span class="import-result-value">{{ importResult.categories }}</span></div>
        <div v-if="importResult.tags > 0" class="import-result-row"><span>New tags:</span><span class="import-result-value">{{ importResult.tags }}</span></div>
        <div v-if="importResult.skipped > 0" class="import-result-row"><span>Skipped:</span><span class="import-result-value warning">{{ importResult.skipped }}</span></div>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-secondary" @click="$emit('close')">Close</button>
        <button class="btn btn-primary" :disabled="!jsonData || importing" @click="doImport">
          {{ importing ? 'Importing...' : 'Import' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { getDB } from '../../db.js'

const emit = defineEmits(['close', 'imported'])

const fileInput = ref(null)
const jsonData = ref(null)
const previewCount = ref(null)
const existingCount = ref(null)
const onConflict = ref('skip')
const importing = ref(false)
const importResult = ref(null)

async function onFileSelect(event) {
  const file = event.target.files[0]
  if (!file) return

  try {
    const text = await file.text()
    const data = JSON.parse(text)
    if (!Array.isArray(data)) throw new Error('Expected JSON array')
    jsonData.value = data
    previewCount.value = data.length

    // Count how many already exist
    const db = await getDB()
    const existing = await db.bookmarks.toArray()
    const existingTweetIds = new Set(existing.map(b => b.tweetId))
    existingCount.value = data.filter(item => existingTweetIds.has(item.tweetId)).length
  } catch (e) {
    alert('Invalid JSON file: ' + e.message)
    jsonData.value = null
    previewCount.value = null
  }
}

async function doImport() {
  if (!jsonData.value) return
  importing.value = true
  importResult.value = null

  try {
    const db = await getDB()
    const result = await db.importFromJSON(jsonData.value, { onConflict: onConflict.value })
    importResult.value = result
    emit('imported', result)
  } catch (e) {
    alert('Import failed: ' + e.message)
  } finally {
    importing.value = false
  }
}
</script>

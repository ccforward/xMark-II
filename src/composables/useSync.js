import { ref } from 'vue'

const syncState = ref('idle')
const syncMessage = ref('')
let autoDismissTimer = null

export function useSync() {
  function dismissStatus() {
    syncState.value = 'idle'
    syncMessage.value = ''
  }

  function autoDismissSuccess() {
    clearTimeout(autoDismissTimer)
    autoDismissTimer = setTimeout(() => {
      if (syncState.value === 'completed') dismissStatus()
    }, 3000)
  }

  function startSync(fullSync, onComplete) {
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
        autoDismissSuccess()
        onComplete?.()
      } else if (response?.status === 'error') {
        syncState.value = 'error'
        syncMessage.value = response.message
      }
    })
  }

  function handleSyncMessage(message, onComplete) {
    if (message.type === 'SYNC_STATUS_UPDATE') {
      syncState.value = message.state
      syncMessage.value = message.message
      if (message.state === 'completed') {
        autoDismissSuccess()
        onComplete?.()
      }
    }
  }

  return {
    syncState,
    syncMessage,
    startSync,
    dismissStatus,
    handleSyncMessage,
  }
}

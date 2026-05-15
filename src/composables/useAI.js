// useAI.js - Vue composable for AI state

import { ref } from 'vue'

const aiConfig = ref(null)
const aiProcessing = ref(false)
const aiProgress = ref(null)

export function useAI() {
  async function loadAIConfig() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_AI_CONFIG' }, (response) => {
        aiConfig.value = response || {
          models: [],
          activeModelId: null,
          autoProcessAfterSync: true,
          systemPrompt: '',
          outputLanguage: 'en',
        }
        resolve(aiConfig.value)
      })
    })
  }

  async function saveAIConfig(config) {
    aiConfig.value = config
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'SET_AI_CONFIG', config }, () => resolve())
    })
  }

  async function processSingleBookmark(bookmarkId) {
    aiProcessing.value = true
    try {
      return await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'AI_PROCESS_SINGLE', bookmarkId }, (response) => {
          if (response?.error) reject(new Error(response.error))
          else resolve(response?.bookmark)
        })
      })
    } finally {
      aiProcessing.value = false
    }
  }

  async function processAllUnprocessed() {
    aiProcessing.value = true
    try {
      return await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'AI_PROCESS_UNPROCESSED' }, (response) => {
          if (response?.error) reject(new Error(response.error))
          else resolve(response)
        })
      })
    } finally {
      aiProcessing.value = false
      aiProgress.value = null
    }
  }

  return {
    aiConfig,
    aiProcessing,
    aiProgress,
    loadAIConfig,
    saveAIConfig,
    processSingleBookmark,
    processAllUnprocessed,
  }
}

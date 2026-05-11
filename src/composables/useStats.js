import { ref } from 'vue'
import { getDB } from '../db.js'

const statsData = ref({})
const duplicates = ref([])

export function useStats() {
  async function loadStatsData() {
    const db = await getDB()
    statsData.value = await db.getStats()
  }

  async function scanDuplicates() {
    const db = await getDB()
    duplicates.value = await db.findDuplicates()
  }

  async function mergeDuplicate(keepId, removeId) {
    const db = await getDB()
    await db.mergeDuplicates(keepId, removeId)
    duplicates.value = duplicates.value.filter(
      d => d.duplicate.id !== removeId && d.original.id !== removeId
    )
  }

  return {
    statsData,
    duplicates,
    loadStatsData,
    scanDuplicates,
    mergeDuplicate,
  }
}

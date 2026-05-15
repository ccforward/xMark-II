import { ref } from 'vue'
import { getDB } from '../db.js'

const statsData = ref({})

export function useStats() {
  async function loadStatsData() {
    const db = await getDB()
    statsData.value = await db.getStats()
  }

  return {
    statsData,
    loadStatsData,
  }
}

<template>
  <div class="stats-section">
    <div class="heatmap-header">
      <h3>{{ totalCount }} bookmarks in {{ selectedYear }}</h3>
    </div>
    <div class="heatmap-layout">
      <div class="heatmap-main">
        <div class="heatmap-container">
          <div class="heatmap-months">
            <span v-for="m in monthLabels" :key="m.label + m.offset" :style="{ left: m.offset + 'px' }">{{ m.label }}</span>
          </div>
          <div class="heatmap-grid">
            <div class="heatmap-days-label">
              <span></span>
              <span>Mon</span>
              <span></span>
              <span>Wed</span>
              <span></span>
              <span>Fri</span>
              <span></span>
            </div>
            <div class="heatmap-weeks">
              <div v-for="(week, wi) in weeks" :key="wi" class="heatmap-week">
                <div
                  v-for="(day, di) in week"
                  :key="di"
                  class="heatmap-cell"
                  :class="[day.level >= 0 ? 'level-' + day.level : 'empty']"
                  @mouseenter="showTooltip(day, $event)"
                  @mouseleave="hideTooltip"
                ></div>
              </div>
            </div>
          </div>
          <div class="heatmap-footer">
            <div class="heatmap-legend">
              <span>Less</span>
              <div class="heatmap-cell level-0"></div>
              <div class="heatmap-cell level-1"></div>
              <div class="heatmap-cell level-2"></div>
              <div class="heatmap-cell level-3"></div>
              <div class="heatmap-cell level-4"></div>
              <span>More</span>
            </div>
          </div>
        </div>
      </div>
      <div class="heatmap-years">
        <button
          v-for="year in availableYears"
          :key="year"
          class="heatmap-year-btn"
          :class="{ active: year === selectedYear }"
          @click="selectYear(year)"
        >{{ year }}</button>
      </div>
    </div>
    <!-- Tooltip -->
    <div v-if="tooltip.visible" class="heatmap-tooltip" :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }">
      <strong>{{ tooltip.count }} {{ tooltip.count === 1 ? 'bookmark' : 'bookmarks' }}</strong> on {{ tooltip.dateStr }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getDB } from '../../db.js'

const allBookmarks = ref([])
const selectedYear = ref(new Date().getFullYear())
const tooltip = ref({ visible: false, x: 0, y: 0, count: 0, dateStr: '' })

onMounted(async () => {
  const db = await getDB()
  allBookmarks.value = await db.bookmarks.toArray()
})

const availableYears = computed(() => {
  const years = new Set()
  for (const b of allBookmarks.value) {
    const d = new Date(b.createdAt)
    if (!isNaN(d.getTime())) years.add(d.getFullYear())
  }
  const sorted = [...years].sort((a, b) => b - a)
  if (sorted.length === 0) sorted.push(new Date().getFullYear())
  return sorted
})

const dayCountMap = computed(() => {
  const map = {}
  for (const b of allBookmarks.value) {
    const d = new Date(b.createdAt)
    if (!isNaN(d.getTime())) {
      const key = d.toISOString().split('T')[0]
      map[key] = (map[key] || 0) + 1
    }
  }
  return map
})

const totalCount = computed(() => {
  let count = 0
  const year = selectedYear.value
  for (const [dateStr, c] of Object.entries(dayCountMap.value)) {
    if (dateStr.startsWith(String(year))) count += c
  }
  return count
})

const weeks = computed(() => {
  const year = selectedYear.value
  const now = new Date()
  const isCurrentYear = year === now.getFullYear()

  // Determine the date range for this year
  let startDate, endDate
  if (isCurrentYear) {
    // Current year: show from Jan 1 to today (like GitHub)
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    startDate = new Date(year, 0, 1)
  } else {
    // Past year: show full year Jan 1 - Dec 31
    startDate = new Date(year, 0, 1)
    endDate = new Date(year, 11, 31)
  }

  // Align start to Sunday (GitHub convention)
  const startDay = startDate.getDay()
  const gridStart = new Date(startDate)
  gridStart.setDate(gridStart.getDate() - startDay)

  // Align end to Saturday
  const endDay = endDate.getDay()
  const gridEnd = new Date(endDate)
  gridEnd.setDate(gridEnd.getDate() + (6 - endDay))

  // Get max count for this year to calculate levels
  const yearCounts = []
  for (const [dateStr, c] of Object.entries(dayCountMap.value)) {
    if (dateStr.startsWith(String(year))) yearCounts.push(c)
  }
  const maxCount = Math.max(...yearCounts, 1)
  const q1 = Math.ceil(maxCount * 0.25)
  const q2 = Math.ceil(maxCount * 0.5)
  const q3 = Math.ceil(maxCount * 0.75)

  const result = []
  const current = new Date(gridStart)
  while (current <= gridEnd) {
    const week = []
    for (let d = 0; d < 7; d++) {
      const dateStr = current.toISOString().split('T')[0]
      const inRange = current >= startDate && current <= endDate
      const count = dayCountMap.value[dateStr] || 0
      let level = -1
      if (inRange) {
        level = 0
        if (count > 0) level = count <= q1 ? 1 : count <= q2 ? 2 : count <= q3 ? 3 : 4
      }
      week.push({ date: dateStr, count, level })
      current.setDate(current.getDate() + 1)
    }
    result.push(week)
  }
  return result
})

const monthLabels = computed(() => {
  const labels = []
  let lastMonth = -1
  for (let w = 0; w < weeks.value.length; w++) {
    const firstDay = weeks.value[w][0]
    if (firstDay.level < 0) continue
    const d = new Date(firstDay.date)
    const month = d.getMonth()
    if (month !== lastMonth) {
      lastMonth = month
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      labels.push({ label: monthNames[month], offset: w * 15 })
    }
  }
  return labels
})

function selectYear(year) {
  selectedYear.value = year
}

function showTooltip(day, event) {
  if (day.level < 0) return
  const rect = event.target.getBoundingClientRect()
  const parentRect = event.target.closest('.stats-section').getBoundingClientRect()
  tooltip.value = {
    visible: true,
    x: rect.left - parentRect.left + rect.width / 2,
    y: rect.top - parentRect.top - 36,
    count: day.count,
    dateStr: formatTooltipDate(day.date),
  }
}

function hideTooltip() {
  tooltip.value.visible = false
}

function formatTooltipDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const day = d.getDate()
  const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th'
  return `${months[d.getMonth()]} ${day}${suffix}`
}
</script>

<style scoped>
.stats-section {
  position: relative;
}
.heatmap-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.heatmap-header h3 {
  font-size: 16px;
  font-weight: 400;
  color: var(--text);
  margin: 0;
}
.heatmap-layout {
  display: flex;
  gap: 16px;
}
.heatmap-main {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
}
.heatmap-years {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 28px;
}
.heatmap-year-btn {
  background: none;
  border: none;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px 12px;
  border-radius: 4px;
  text-align: right;
  white-space: nowrap;
  font-weight: 400;
}
.heatmap-year-btn:hover {
  color: var(--text);
}
.heatmap-year-btn.active {
  font-weight: 700;
  color: var(--text);
  background: var(--bg-tertiary);
}
.heatmap-container {
  position: relative;
}
.heatmap-months {
  position: relative;
  height: 20px;
  margin-bottom: 4px;
  margin-left: 36px;
}
.heatmap-months span {
  position: absolute;
  font-size: 11px;
  color: var(--text-muted);
}
.heatmap-grid {
  display: flex;
  gap: 4px;
}
.heatmap-days-label {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  padding: 0;
  width: 28px;
  flex-shrink: 0;
}
.heatmap-days-label span {
  font-size: 10px;
  color: var(--text-muted);
  line-height: 13px;
  height: 13px;
}
.heatmap-weeks {
  display: flex;
  gap: 3px;
}
.heatmap-week {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.heatmap-cell {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: var(--bg-tertiary);
  outline: 1px solid rgba(27, 31, 35, 0.04);
  outline-offset: -1px;
}
.heatmap-cell.empty {
  background: transparent;
  outline: none;
}
.heatmap-cell.level-0 { background: var(--bg-tertiary); }
.heatmap-cell.level-1 { background: #9be9a8; }
.heatmap-cell.level-2 { background: #40c463; }
.heatmap-cell.level-3 { background: #30a14e; }
.heatmap-cell.level-4 { background: #216e39; }
.heatmap-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  margin-left: 36px;
}
.heatmap-learn-more {
  font-size: 11px;
  color: var(--text-muted);
  text-decoration: none;
}
.heatmap-learn-more:hover {
  color: var(--accent);
}
.heatmap-legend {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--text-muted);
}
.heatmap-legend .heatmap-cell {
  width: 10px;
  height: 10px;
}
.heatmap-tooltip {
  position: absolute;
  transform: translateX(-50%);
  background: #24292f;
  color: #fff;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 6px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.heatmap-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: #24292f;
}
</style>

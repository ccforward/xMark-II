<template>
  <div class="stats-section">
    <h3>Weekly Trend</h3>
    <div class="chart-container">
      <Line :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Line } from 'vue-chartjs'

const props = defineProps({
  data: { type: Array, required: true },
})

const chartData = computed(() => ({
  labels: props.data.map(d => d.date.slice(5)),
  datasets: [{
    data: props.data.map(d => d.count),
    borderColor: '#1d9bf0',
    backgroundColor: 'rgba(29, 155, 240, 0.08)',
    fill: true,
    tension: 0.35,
    pointRadius: 3,
    pointHoverRadius: 5,
    pointBackgroundColor: '#1d9bf0',
    borderWidth: 2,
  }],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { intersect: false, mode: 'index' },
  plugins: {
    tooltip: { callbacks: { title: (items) => `Week of ${items[0].label}` } },
  },
  scales: {
    x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } },
    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { precision: 0 } },
  },
}
</script>

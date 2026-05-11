<template>
  <div class="stats-section">
    <h3>Tweet Activity (Last 30 days)</h3>
    <div class="chart-container">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'

const props = defineProps({
  data: { type: Array, required: true },
})

const chartData = computed(() => ({
  labels: props.data.map(d => d.date.slice(5)),
  datasets: [{
    data: props.data.map(d => d.count),
    backgroundColor: 'rgba(29, 155, 240, 0.5)',
    hoverBackgroundColor: '#1d9bf0',
    borderRadius: 3,
    borderSkipped: false,
  }],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    tooltip: { callbacks: { title: (items) => items[0].label } },
  },
  scales: {
    x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } },
    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { precision: 0 } },
  },
}
</script>

<template>
  <div class="stats-section">
    <h3>Tweets by Day of Week</h3>
    <div class="chart-container chart-container--short">
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
  labels: props.data.map(d => d.dayName),
  datasets: [{
    data: props.data.map(d => d.count),
    backgroundColor: 'rgba(29, 155, 240, 0.6)',
    hoverBackgroundColor: '#1d9bf0',
    borderRadius: 4,
    borderSkipped: false,
  }],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  plugins: {
    tooltip: { callbacks: { title: (items) => items[0].label } },
  },
  scales: {
    x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { precision: 0 } },
    y: { grid: { display: false } },
  },
}
</script>

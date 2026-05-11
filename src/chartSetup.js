import {
  Chart,
  LineController,
  BarController,
  LineElement,
  BarElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'

Chart.register(
  LineController,
  BarController,
  LineElement,
  BarElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend
)

// Global defaults
Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
Chart.defaults.font.size = 12
Chart.defaults.color = '#536471'
Chart.defaults.plugins.legend.display = false
Chart.defaults.plugins.tooltip.backgroundColor = '#0f1419'
Chart.defaults.plugins.tooltip.titleFont = { weight: '600' }
Chart.defaults.plugins.tooltip.cornerRadius = 8
Chart.defaults.plugins.tooltip.padding = 10

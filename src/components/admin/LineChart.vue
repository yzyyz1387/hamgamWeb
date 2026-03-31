<template>
  <div class="chart-container">
    <div class="chart-header">
      <h3 class="chart-title">{{ title }}</h3>
      <slot name="actions"></slot>
    </div>
    <div class="chart-wrapper">
      <Line v-if="chartData" :data="chartData" :options="mergedOptions" />
      <div v-else class="chart-loading">
        <mdui-circular-progress></mdui-circular-progress>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const props = defineProps({
  title: { type: String, default: '' },
  labels: { type: Array, default: () => [] },
  datasets: { type: Array, default: () => [] },
  options: { type: Object, default: () => ({}) },
})

const defaultOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'top',
      labels: {
        usePointStyle: true,
        padding: 16,
        font: { size: 12 },
      },
    },
    tooltip: {
      backgroundColor: 'rgba(17, 24, 39, 0.9)',
      titleFont: { size: 13 },
      bodyFont: { size: 12 },
      padding: 10,
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { size: 11 }, color: '#8a9aaa' },
    },
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(17, 24, 39, 0.06)' },
      ticks: { font: { size: 11 }, color: '#8a9aaa' },
    },
  },
  interaction: {
    intersect: false,
    mode: 'index',
  },
}

const mergedOptions = computed(() => ({
  ...defaultOptions,
  ...props.options,
}))

const chartData = computed(() => {
  if (!props.labels.length || !props.datasets.length) return null
  return {
    labels: props.labels,
    datasets: props.datasets.map(ds => ({
      tension: 0.4,
      fill: true,
      pointRadius: 4,
      pointHoverRadius: 6,
      ...ds,
    })),
  }
})
</script>

<style scoped>
.chart-container {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  border: 1px solid rgba(24, 34, 44, 0.08);
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.chart-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: #18222c;
}

.chart-wrapper {
  height: 240px;
  position: relative;
}

.chart-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #8a9aaa;
}
</style>

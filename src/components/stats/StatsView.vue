<template>
  <div class="stats-view">
    <div class="page-header">
      <h1 class="page-title">Statistics</h1>
    </div>

    <SummaryCards :stats="statsData" />

    <EngagementCards v-if="statsData.engagement" :engagement="statsData.engagement" />

    <ActivityHeatmap v-if="statsData.heatmap" :heatmap="statsData.heatmap" />

    <WeeklyTrendChart v-if="statsData.weeklyData?.length > 1" :data="statsData.weeklyData" />

    <HourOfDayChart v-if="statsData.hourDistribution?.length" :data="statsData.hourDistribution" />

    <DayOfWeekChart v-if="statsData.dayOfWeekDistribution?.length" :data="statsData.dayOfWeekDistribution" />

    <TimelineChart v-if="statsData.timeline?.length" :data="statsData.timeline" />

    <TopAuthorsList v-if="statsData.topAuthors?.length" :authors="statsData.topAuthors" />

    <DistributionList v-if="statsData.tags?.length" title="Tag Distribution" :items="statsData.tags" :total="statsData.total" variant="tag" />

    <DistributionList v-if="statsData.languages?.length" title="Language Distribution" :items="statsData.languages" :total="statsData.total" />
  </div>
</template>

<script setup>
import SummaryCards from './SummaryCards.vue'
import EngagementCards from './EngagementCards.vue'
import ActivityHeatmap from './ActivityHeatmap.vue'
import WeeklyTrendChart from './WeeklyTrendChart.vue'
import HourOfDayChart from './HourOfDayChart.vue'
import DayOfWeekChart from './DayOfWeekChart.vue'
import TimelineChart from './TimelineChart.vue'
import TopAuthorsList from './TopAuthorsList.vue'
import DistributionList from './DistributionList.vue'

defineProps({
  statsData: { type: Object, required: true },
})
</script>

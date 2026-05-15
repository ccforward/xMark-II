<template>
  <div class="stats-view">
    <div class="page-header">
      <h1 class="page-title">Rankings</h1>
    </div>

    <TopTweetsList v-if="statsData.topTweets?.byLikes?.length" title="Most Liked" :tweets="statsData.topTweets.byLikes" metricKey="likeCount" />

    <TopTweetsList v-if="statsData.topTweets?.byReposts?.length" title="Most Reposted" :tweets="statsData.topTweets.byReposts" metricKey="retweetCount" />

    <TopTweetsList v-if="statsData.topTweets?.byReplies?.length" title="Most Discussed" :tweets="statsData.topTweets.byReplies" metricKey="replyCount" />

    <TopTweetsList v-if="statsData.topTweets?.byViews?.length" title="Most Viewed" :tweets="statsData.topTweets.byViews" metricKey="viewCount" />

    <TopTweetsList v-if="statsData.topTweets?.byBookmarks?.length" title="Most Bookmarked" :tweets="statsData.topTweets.byBookmarks" metricKey="bookmarkCount" />
  </div>
</template>

<script setup>
import TopTweetsList from './TopTweetsList.vue'

defineProps({
  statsData: { type: Object, required: true },
})
</script>

<template>
  <div class="stats-view">
    <div class="page-header">
      <h1 class="page-title">Rankings</h1>
    </div>

    <TopTweetsList v-if="statsData.topTweets?.byLikes?.length" title="Most Liked" :tweets="statsData.topTweets.byLikes" metricKey="likeCount" @delete="id => $emit('delete', id)" />

    <TopTweetsList v-if="statsData.topTweets?.byReposts?.length" title="Most Reposted" :tweets="statsData.topTweets.byReposts" metricKey="retweetCount" @delete="id => $emit('delete', id)" />

    <TopTweetsList v-if="statsData.topTweets?.byReplies?.length" title="Most Discussed" :tweets="statsData.topTweets.byReplies" metricKey="replyCount" @delete="id => $emit('delete', id)" />

    <TopTweetsList v-if="statsData.topTweets?.byViews?.length" title="Most Viewed" :tweets="statsData.topTweets.byViews" metricKey="viewCount" @delete="id => $emit('delete', id)" />

    <TopTweetsList v-if="statsData.topTweets?.byBookmarks?.length" title="Most Bookmarked" :tweets="statsData.topTweets.byBookmarks" metricKey="bookmarkCount" @delete="id => $emit('delete', id)" />
  </div>
</template>

<script setup>
import TopTweetsList from './TopTweetsList.vue'

defineProps({
  statsData: { type: Object, required: true },
})

defineEmits(['delete'])
</script>

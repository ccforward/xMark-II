<template>
  <div class="stats-section">
    <h3>{{ title }}</h3>
    <div class="top-tweets-list">
      <div v-for="(tweet, i) in tweets" :key="tweet.tweetId" class="top-tweet-item">
        <span class="top-tweet-rank" :class="'rank-' + (i + 1)">{{ i + 1 }}</span>
        <img v-if="tweet.authorAvatarUrl" :src="tweet.authorAvatarUrl" class="top-tweet-avatar" />
        <div v-else class="top-tweet-avatar placeholder-avatar">{{ (tweet.authorName || '?')[0] }}</div>
        <div class="top-tweet-body">
          <div class="top-tweet-header">
            <a :href="'https://x.com/' + tweet.authorHandle" target="_blank" class="top-tweet-author">@{{ tweet.authorHandle }}</a>
          </div>
          <template v-if="tweet.text">
            <a :href="tweet.tweetUrl" target="_blank" class="top-tweet-text">{{ truncate(tweet.text, 160) }}</a>
          </template>
          <a v-else :href="tweet.tweetUrl" target="_blank" class="top-tweet-text top-tweet-text-empty">View tweet →</a>
          <div v-if="tweet.mediaUrls.length" class="top-tweet-media">
            <div v-for="(url, j) in tweet.mediaUrls.slice(0, 4)" :key="j" class="top-tweet-media-item">
              <img :src="url" loading="lazy" />
              <div v-if="tweet.mediaTypes[j] === 'video'" class="top-tweet-video-badge">▶</div>
              <div v-if="tweet.mediaTypes[j] === 'animated_gif'" class="top-tweet-video-badge">GIF</div>
            </div>
          </div>
        </div>
        <span class="top-tweet-metric">{{ formatNum(tweet[metricKey]) }}</span>
        <button class="top-tweet-delete" title="Delete" @click="handleDelete(tweet)"><Trash2 :size="15" /></button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Trash2 } from 'lucide-vue-next'

const props = defineProps({
  title: { type: String, required: true },
  tweets: { type: Array, required: true },
  metricKey: { type: String, required: true },
})

const emit = defineEmits(['delete'])

function handleDelete(tweet) {
  if (!confirm('Delete this bookmark from local storage?')) return
  emit('delete', tweet.id || tweet.tweetId)
}

function truncate(text, maxLen) {
  if (!text) return ''
  return text.length <= maxLen ? text : text.substring(0, maxLen) + '...'
}

function formatNum(n) {
  if (!n) return '0'
  n = parseInt(n)
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}
</script>

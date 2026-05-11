<template>
  <div class="bookmark-item">
    <div class="bookmark-checkbox" :class="{ checked: selected }">
      <input type="checkbox" :checked="selected" @change="$emit('toggle-select', bookmark.id)" />
    </div>
    <a :href="'https://x.com/' + (bookmark.authorHandle || '_')" target="_blank" class="avatar-link">
      <img v-if="bookmark.authorAvatarUrl" :src="bookmark.authorAvatarUrl" class="bookmark-avatar" loading="lazy" />
      <div v-else class="bookmark-avatar placeholder-avatar">{{ (bookmark.authorName || '?')[0] }}</div>
    </a>
    <div class="bookmark-body">
      <div class="bookmark-header">
        <a :href="'https://x.com/' + (bookmark.authorHandle || '_')" target="_blank" class="bookmark-author">{{ bookmark.authorName || 'Unknown' }}</a>
        <a :href="'https://x.com/' + (bookmark.authorHandle || '_')" target="_blank" class="bookmark-handle">@{{ bookmark.authorHandle || '?' }}</a>
        <span class="bookmark-date-sep">&middot;</span>
        <a :href="bookmark.tweetUrl" target="_blank" class="bookmark-date">{{ formatDate(bookmark.createdAt) }}</a>
      </div>

      <a :href="bookmark.tweetUrl" target="_blank" class="bookmark-text-link">
        <div v-if="bookmark.noteText" class="bookmark-text note-text">
          <span class="note-badge">Note</span>
          {{ truncateText(bookmark.noteText, 500) }}
        </div>
        <div v-else-if="bookmark.text" class="bookmark-text">{{ bookmark.text }}</div>
        <div v-else-if="!bookmark.article" class="bookmark-text empty-text">[No text content]</div>
      </a>

      <!-- Article Card -->
      <a v-if="bookmark.article" :href="bookmark.article.articleUrl || bookmark.tweetUrl" target="_blank" class="article-card">
        <img v-if="bookmark.article.coverImageUrl" :src="bookmark.article.coverImageUrl" class="article-card-cover" loading="lazy" />
        <div class="article-card-body">
          <span class="article-badge">Article</span>
          <div class="article-card-title">{{ bookmark.article.title }}</div>
          <div v-if="bookmark.article.previewText" class="article-card-preview">{{ truncateText(bookmark.article.previewText, 200) }}</div>
        </div>
      </a>

      <!-- Media -->
      <div v-if="mediaItems.length" class="bookmark-media" :class="'media-count-' + Math.min(mediaItems.length, 4)">
        <div v-for="(media, i) in mediaItems.slice(0, 4)" :key="i" class="media-item" @click="$emit('open-media', bookmark, i)">
          <img :src="media.thumbnail" loading="lazy" />
          <div v-if="media.type === 'video'" class="video-badge"><Play :size="14" /></div>
          <div v-if="media.type === 'animated_gif'" class="video-badge">GIF</div>
        </div>
      </div>

      <!-- Quoted Tweet -->
      <div v-if="bookmark.quotedTweet" class="quoted-tweet">
        <a :href="bookmark.quotedTweet.tweetUrl" target="_blank" class="quoted-tweet-link">
          <div class="quoted-tweet-header">
            <img v-if="bookmark.quotedTweet.authorAvatarUrl" :src="bookmark.quotedTweet.authorAvatarUrl" class="quoted-tweet-avatar" />
            <span class="quoted-tweet-author">{{ bookmark.quotedTweet.authorName }}</span>
            <span class="quoted-tweet-handle">@{{ bookmark.quotedTweet.authorHandle }}</span>
          </div>
          <div class="quoted-tweet-text">{{ truncateText(bookmark.quotedTweet.text, 280) }}</div>
          <div v-if="bookmark.quotedTweet.mediaUrls?.length" class="quoted-tweet-media">
            <img v-for="(url, i) in bookmark.quotedTweet.mediaUrls.slice(0, 2)" :key="i" :src="url" loading="lazy" />
          </div>
        </a>
      </div>

      <!-- External URLs -->
      <div v-if="bookmark.urls?.length" class="bookmark-urls">
        <a v-for="(url, i) in bookmark.urls.slice(0, 3)" :key="i" :href="url" target="_blank" class="external-url">
          <ExternalLink :size="14" /> {{ shortenUrl(url) }}
        </a>
      </div>

      <!-- Stats -->
      <div class="bookmark-stats">
        <span v-if="bookmark.replyCount" title="Replies"><MessageCircle :size="14" /> {{ formatNum(bookmark.replyCount) }}</span>
        <span v-if="bookmark.retweetCount" title="Reposts"><Repeat2 :size="14" /> {{ formatNum(bookmark.retweetCount) }}</span>
        <span v-if="bookmark.likeCount" title="Likes"><Heart :size="14" /> {{ formatNum(bookmark.likeCount) }}</span>
        <span v-if="bookmark.viewCount" title="Views"><Eye :size="14" /> {{ formatNum(bookmark.viewCount) }}</span>
        <span v-if="bookmark.bookmarkCount" title="Bookmarks"><Bookmark :size="14" /> {{ formatNum(bookmark.bookmarkCount) }}</span>
      </div>

      <!-- Tags -->
      <div v-if="bookmark.tags?.length" class="bookmark-tags">
        <span v-for="t in bookmark.tags" :key="t" class="tag-badge" :style="getTagStyle(t)">
          {{ t }}
          <button class="tag-remove" @click="$emit('remove-tag', bookmark.id, t)">&times;</button>
        </span>
      </div>

      <!-- Notes -->
      <div v-if="bookmark.notes" class="bookmark-notes">
        <span class="notes-label">Note:</span> {{ bookmark.notes }}
      </div>

      <!-- Footer -->
      <div class="bookmark-footer">
        <div class="bookmark-actions">
          <div class="category-dropdown">
            <button class="icon-btn" title="Add tag" @click="$emit('toggle-dropdown', bookmark.id, 'tag')"><Hash :size="16" /></button>
            <div v-if="dropdownOpen === 'tag'" class="category-dropdown-menu">
              <div v-for="tag in tags" :key="tag.name" class="category-dropdown-item" :class="{ assigned: bookmark.tags?.includes(tag.name) }" @click="$emit('add-tag', bookmark.id, tag.name)">
                <span class="tag-dot" :style="{ background: tag.color }"></span>
                {{ tag.name }}
              </div>
              <div class="category-dropdown-item" @click="$emit('prompt-new-tag', bookmark.id)">+ New tag...</div>
            </div>
          </div>
          <div class="category-dropdown">
            <button class="icon-btn" title="Add to collection" @click="$emit('toggle-dropdown', bookmark.id, 'col')"><Library :size="16" /></button>
            <div v-if="dropdownOpen === 'col'" class="category-dropdown-menu">
              <div v-for="col in collections" :key="col.id" class="category-dropdown-item" @click="$emit('add-to-collection', col.id, bookmark.id)">
                <Library :size="14" /> {{ col.name }}
              </div>
              <div v-if="collections.length === 0" class="category-dropdown-item" style="color:var(--text-muted)">No collections yet</div>
            </div>
          </div>
          <button class="icon-btn" title="Add note" @click="$emit('edit-note', bookmark)"><PenLine :size="16" /></button>
          <a :href="bookmark.tweetUrl" target="_blank" class="icon-btn" title="Open on X"><ArrowUpRight :size="16" /></a>
          <button class="icon-btn" title="Delete" @click="$emit('delete', bookmark.id)"><Trash2 :size="16" /></button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Play, ExternalLink, MessageCircle, Repeat2, Heart, Eye, Bookmark, Hash, Library, PenLine, ArrowUpRight, Trash2 } from 'lucide-vue-next'

const props = defineProps({
  bookmark: { type: Object, required: true },
  selected: Boolean,
  tags: Array,
  collections: Array,
  openDropdownId: [Number, null],
  dropdownType: String,
})

defineEmits([
  'toggle-select', 'open-media', 'remove-tag',
  'toggle-dropdown', 'add-tag', 'add-to-collection',
  'prompt-new-tag', 'edit-note', 'delete',
])

const dropdownOpen = computed(() => {
  if (props.openDropdownId === props.bookmark.id) return props.dropdownType
  return null
})

const mediaItems = computed(() => {
  const items = []
  const mediaUrls = props.bookmark.mediaUrls || []
  const mediaTypes = props.bookmark.mediaTypes || []
  const videoUrls = props.bookmark.videoUrls || []
  let videoIdx = 0
  for (let i = 0; i < mediaUrls.length; i++) {
    const type = mediaTypes[i] || 'photo'
    const thumbUrl = mediaUrls[i]
    let highResUrl = thumbUrl
    if (type === 'photo' && thumbUrl.includes('pbs.twimg.com')) {
      highResUrl = thumbUrl.split('?')[0] + '?format=jpg&name=4096x4096'
    }
    const item = { thumbnail: thumbUrl, type, url: highResUrl }
    if (type === 'video' || type === 'animated_gif') {
      item.videoUrl = videoUrls[videoIdx] || ''
      videoIdx++
    }
    items.push(item)
  }
  return items
})

function formatNum(n) {
  if (!n) return '0'
  n = parseInt(n)
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function truncateText(text, maxLen) {
  if (!text) return ''
  return text.length <= maxLen ? text : text.substring(0, maxLen) + '...'
}

function shortenUrl(url) {
  try {
    const u = new URL(url)
    let path = u.pathname + u.search
    if (path.length > 40) path = path.substring(0, 37) + '...'
    return u.hostname + path
  } catch { return url.substring(0, 50) }
}

function getTagStyle(tagName) {
  const tag = props.tags?.find(t => t.name === tagName)
  if (tag) return { color: tag.color, borderColor: tag.color, background: tag.color + '15' }
  return { color: 'var(--text-secondary)', borderColor: 'var(--border)', background: 'transparent' }
}
</script>

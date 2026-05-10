<template>
  <div class="app-layout">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-brand">XB Sync</div>

      <div class="sidebar-section-title">View</div>
      <div class="sidebar-item" :class="{ active: currentView === 'all' }" @click="switchView('all')">
        <span>📋</span><span>All Bookmarks</span>
        <span class="count">{{ stats.bookmarkCount }}</span>
      </div>
      <div class="sidebar-item" :class="{ active: currentView === 'uncategorized' }" @click="switchView('uncategorized')">
        <span>📭</span><span>Uncategorized</span>
      </div>
      <div class="sidebar-item" :class="{ active: currentView === 'stats' }" @click="switchView('stats')">
        <span>📊</span><span>Statistics</span>
      </div>
      <div class="sidebar-item" :class="{ active: currentView === 'duplicates' }" @click="switchView('duplicates')">
        <span>🔍</span><span>Duplicates</span>
      </div>

      <div class="sidebar-section-title">Categories</div>
      <div
        v-for="cat in categories"
        :key="cat.name"
        class="sidebar-item"
        :class="{ active: currentView === 'category:' + cat.name }"
        @click="switchView('category:' + cat.name)"
      >
        <span class="category-dot" :style="{ background: cat.color }"></span>
        <span>{{ cat.name }}</span>
      </div>

      <div class="sidebar-section-title">Tags</div>
      <div
        v-for="tag in tags"
        :key="tag.name"
        class="sidebar-item"
        :class="{ active: currentView === 'tag:' + tag.name }"
        @click="switchView('tag:' + tag.name)"
      >
        <span class="tag-dot" :style="{ background: tag.color }"></span>
        <span>#{{ tag.name }}</span>
      </div>

      <div class="sidebar-section-title">Collections</div>
      <div
        v-for="col in collections"
        :key="col.id"
        class="sidebar-item"
        :class="{ active: currentView === 'collection:' + col.id }"
        @click="switchView('collection:' + col.id)"
      >
        <span>📚</span><span>{{ col.name }}</span>
      </div>
      <div class="sidebar-item" @click="showCreateCollectionModal = true">
        <span>➕</span><span>New Collection</span>
      </div>

      <div class="sidebar-section-title" style="margin-top:auto">Actions</div>
      <div class="sidebar-item" @click="showExportModal = true">
        <span>📤</span><span>Export</span>
      </div>
      <div class="sidebar-item" @click="showCategoryModal = true">
        <span>🏷️</span><span>Manage Categories</span>
      </div>
      <div class="sidebar-item" @click="showTagModal = true">
        <span>🏷️</span><span>Manage Tags</span>
      </div>
      <div class="sidebar-item" @click="showSettingsModal = true">
        <span>⚙️</span><span>Settings</span>
      </div>
      <div class="sidebar-item" @click="handleLoadMockData">
        <span>🧪</span><span>Load Mock Data</span>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Stats View -->
      <div v-if="currentView === 'stats'" class="stats-view">
        <div class="page-header">
          <h1 class="page-title">Statistics</h1>
        </div>

        <!-- Summary Cards -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-number">{{ statsData.total || 0 }}</div>
            <div class="stat-label">Total Bookmarks</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ statsData.withMedia || 0 }}</div>
            <div class="stat-label">With Media</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ statsData.withVideo || 0 }}</div>
            <div class="stat-label">With Video</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ statsData.withNotes || 0 }}</div>
            <div class="stat-label">Articles/Notes</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ statsData.topAuthors?.length || 0 }}</div>
            <div class="stat-label">Unique Authors</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ statsData.uncategorized || 0 }}</div>
            <div class="stat-label">Uncategorized</div>
          </div>
        </div>

        <!-- GitHub-style Contribution Heatmap -->
        <div v-if="statsData.heatmap" class="stats-section">
          <h3>Bookmark Activity (Last 12 months)</h3>
          <div class="heatmap-container">
            <div class="heatmap-months">
              <span v-for="m in statsData.heatmap.months" :key="m.label" :style="{ left: m.offset + 'px' }">{{ m.label }}</span>
            </div>
            <div class="heatmap-grid">
              <div class="heatmap-days-label">
                <span>Mon</span>
                <span>Wed</span>
                <span>Fri</span>
              </div>
              <div class="heatmap-weeks">
                <div v-for="(week, wi) in statsData.heatmap.weeks" :key="wi" class="heatmap-week">
                  <div
                    v-for="(day, di) in week"
                    :key="di"
                    class="heatmap-cell"
                    :class="'level-' + day.level"
                    :title="day.date + ': ' + day.count + ' bookmarks'"
                  ></div>
                </div>
              </div>
            </div>
            <div class="heatmap-legend">
              <span>Less</span>
              <div class="heatmap-cell level-0"></div>
              <div class="heatmap-cell level-1"></div>
              <div class="heatmap-cell level-2"></div>
              <div class="heatmap-cell level-3"></div>
              <div class="heatmap-cell level-4"></div>
              <span>More</span>
            </div>
          </div>
        </div>

        <!-- Activity Line Chart -->
        <div v-if="statsData.lineChart?.points?.length > 1" class="stats-section">
          <h3>Weekly Trend</h3>
          <div class="line-chart-container">
            <svg class="line-chart-svg" viewBox="0 0 800 200" preserveAspectRatio="none">
              <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.3"/>
                  <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.02"/>
                </linearGradient>
              </defs>
              <!-- Area fill -->
              <path :d="statsData.lineChart.areaPath" fill="url(#lineGradient)" />
              <!-- Line -->
              <path :d="statsData.lineChart.linePath" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              <!-- Points -->
              <circle v-for="(p, i) in statsData.lineChart.points" :key="i" :cx="p.x" :cy="p.y" r="3" fill="var(--accent)">
                <title>{{ p.label }}: {{ p.value }}</title>
              </circle>
            </svg>
            <div class="line-chart-labels">
              <span v-for="(label, i) in statsData.lineChart.xLabels" :key="i">{{ label }}</span>
            </div>
          </div>
        </div>

        <!-- Hour of Day Distribution -->
        <div v-if="statsData.hourDistribution?.length" class="stats-section">
          <h3>Bookmarking by Hour of Day</h3>
          <div class="hour-chart">
            <div
              v-for="h in statsData.hourDistribution"
              :key="h.hour"
              class="hour-bar-wrapper"
              :title="h.hour + ':00 - ' + h.count + ' bookmarks'"
            >
              <div class="hour-bar" :style="{ height: (h.count / statsData.maxHourCount * 100) + '%' }"></div>
              <span class="hour-label">{{ h.hour }}</span>
            </div>
          </div>
        </div>

        <!-- Day of Week Distribution -->
        <div v-if="statsData.dayOfWeekDistribution?.length" class="stats-section">
          <h3>Bookmarking by Day of Week</h3>
          <div class="dow-chart">
            <div v-for="d in statsData.dayOfWeekDistribution" :key="d.day" class="dow-item">
              <span class="dow-label">{{ d.dayName }}</span>
              <div class="dow-bar-container">
                <div class="dow-bar" :style="{ width: (d.count / statsData.maxDowCount * 100) + '%' }"></div>
              </div>
              <span class="dow-count">{{ d.count }}</span>
            </div>
          </div>
        </div>

        <!-- Bar Chart: Bookmarks per Day (last 30 days) -->
        <div v-if="statsData.timeline?.length" class="stats-section">
          <h3>Daily Activity (Last 30 days)</h3>
          <div class="timeline-chart">
            <div
              v-for="day in statsData.timeline"
              :key="day.date"
              class="timeline-bar"
              :style="{ height: (day.count / maxTimelineCount * 100) + '%' }"
              :title="day.date + ': ' + day.count"
            ></div>
          </div>
          <div class="timeline-labels">
            <span>{{ statsData.timeline[0]?.date }}</span>
            <span>{{ statsData.timeline[statsData.timeline.length - 1]?.date }}</span>
          </div>
        </div>

        <!-- Top Authors -->
        <div v-if="statsData.topAuthors?.length" class="stats-section">
          <h3>Top Authors</h3>
          <div class="top-authors-list">
            <div v-for="a in statsData.topAuthors.slice(0, 10)" :key="a.handle" class="top-author-item">
              <img v-if="a.avatar" :src="a.avatar" class="top-author-avatar" />
              <div v-else class="top-author-avatar placeholder-avatar">{{ (a.name || '?')[0] }}</div>
              <div class="top-author-info">
                <span class="top-author-name">{{ a.name }}</span>
                <span class="top-author-handle">@{{ a.handle }}</span>
              </div>
              <span class="top-author-count">{{ a.count }}</span>
            </div>
          </div>
        </div>

        <!-- Category Distribution -->
        <div v-if="statsData.categories?.length" class="stats-section">
          <h3>Category Distribution</h3>
          <div class="distribution-list">
            <div v-for="c in statsData.categories" :key="c.name" class="distribution-item">
              <span class="distribution-name">{{ c.name }}</span>
              <div class="distribution-bar-container">
                <div class="distribution-bar" :style="{ width: (c.count / statsData.total * 100) + '%' }"></div>
              </div>
              <span class="distribution-count">{{ c.count }}</span>
            </div>
          </div>
        </div>

        <!-- Tag Distribution -->
        <div v-if="statsData.tags?.length" class="stats-section">
          <h3>Tag Distribution</h3>
          <div class="distribution-list">
            <div v-for="t in statsData.tags" :key="t.name" class="distribution-item">
              <span class="distribution-name">#{{ t.name }}</span>
              <div class="distribution-bar-container">
                <div class="distribution-bar tag-bar" :style="{ width: (t.count / statsData.total * 100) + '%' }"></div>
              </div>
              <span class="distribution-count">{{ t.count }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Duplicates View -->
      <div v-else-if="currentView === 'duplicates'" class="duplicates-view">
        <div class="page-header">
          <h1 class="page-title">Duplicate Detection</h1>
          <button class="btn btn-primary" @click="scanDuplicates">Scan for Duplicates</button>
        </div>
        <div v-if="duplicates.length === 0" class="empty-state">
          <h3>No duplicates found</h3>
          <p>Click "Scan for Duplicates" to check your bookmarks</p>
        </div>
        <div v-else class="duplicate-list">
          <div v-for="(dup, i) in duplicates" :key="i" class="duplicate-pair">
            <div class="duplicate-type">{{ dup.type === 'exact' ? 'Exact duplicate' : 'Similar content' }}</div>
            <div class="duplicate-items">
              <div class="duplicate-item">
                <span class="duplicate-author">@{{ dup.original.authorHandle }}</span>
                <span class="duplicate-text">{{ truncateText(dup.original.text, 80) }}</span>
              </div>
              <div class="duplicate-item">
                <span class="duplicate-author">@{{ dup.duplicate.authorHandle }}</span>
                <span class="duplicate-text">{{ truncateText(dup.duplicate.text, 80) }}</span>
              </div>
            </div>
            <div class="duplicate-actions">
              <button class="btn btn-sm btn-secondary" @click="mergeDuplicate(dup.original.id, dup.duplicate.id)">Keep first, remove second</button>
              <button class="btn btn-sm btn-secondary" @click="mergeDuplicate(dup.duplicate.id, dup.original.id)">Keep second, remove first</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Bookmarks List View (default) -->
      <template v-else>
        <!-- Header -->
        <div class="page-header">
          <h1 class="page-title">{{ viewTitle }}</h1>
          <div class="header-actions">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input v-model="searchQuery" placeholder="Search bookmarks..." @input="debouncedSearch" />
            </div>
            <button class="btn btn-secondary btn-sm" @click="showAdvancedSearch = !showAdvancedSearch">
              {{ showAdvancedSearch ? 'Simple' : 'Advanced' }}
            </button>
            <button class="btn btn-primary" :disabled="syncState === 'syncing'" @click="startSync(false)">
              <span v-if="syncState === 'syncing'" class="spinner"></span>
              {{ syncState === 'syncing' ? 'Syncing...' : 'Sync' }}
            </button>
            <button class="btn btn-secondary" :disabled="syncState === 'syncing'" @click="startSync(true)">Full Sync</button>
          </div>
        </div>

        <!-- Advanced Search Filters -->
        <div v-if="showAdvancedSearch" class="advanced-search">
          <div class="filter-row">
            <div class="filter-item">
              <label>Author</label>
              <input v-model="filters.author" class="form-input" placeholder="Username..." @input="debouncedSearch" />
            </div>
            <div class="filter-item">
              <label>From</label>
              <input v-model="filters.dateFrom" type="date" class="form-input" @change="loadBookmarks" />
            </div>
            <div class="filter-item">
              <label>To</label>
              <input v-model="filters.dateTo" type="date" class="form-input" @change="loadBookmarks" />
            </div>
            <div class="filter-item">
              <label>Media</label>
              <select v-model="filters.mediaType" class="form-input" @change="loadBookmarks">
                <option value="">All</option>
                <option value="media">Has images</option>
                <option value="video">Has video</option>
              </select>
            </div>
          </div>
          <button class="btn btn-sm btn-secondary" @click="clearFilters">Clear Filters</button>
        </div>

        <!-- Sync Status -->
        <div v-if="syncMessage" class="sync-status" :class="syncState">
          <span style="flex:1;white-space:pre-wrap">{{ syncMessage }}</span>
          <button v-if="syncState !== 'syncing'" class="icon-btn" style="color:inherit;font-size:16px" @click="dismissStatus">×</button>
        </div>

        <!-- Bulk Actions -->
        <div v-if="selectedIds.size > 0" class="bulk-actions">
          <span class="count">{{ selectedIds.size }} selected</span>
          <button class="btn btn-sm" @click="bulkCategorize">Categorize</button>
          <button class="btn btn-sm" @click="bulkTag">Tag</button>
          <button class="btn btn-sm" @click="bulkAddToCollection">Add to Collection</button>
          <button class="btn btn-sm" @click="bulkExport">Export</button>
          <button class="btn btn-sm" @click="clearSelection">Deselect</button>
        </div>

        <!-- Bookmark List -->
        <div v-if="bookmarks.length > 0" class="bookmark-list">
          <div v-for="bm in bookmarks" :key="bm.id" class="bookmark-item">
            <div class="bookmark-checkbox" :class="{ checked: selectedIds.has(bm.id) }">
              <input type="checkbox" :checked="selectedIds.has(bm.id)" @change="toggleSelect(bm.id)" />
            </div>
            <a :href="'https://x.com/' + (bm.authorHandle || '_')" target="_blank" class="avatar-link">
              <img v-if="bm.authorAvatarUrl" :src="bm.authorAvatarUrl" class="bookmark-avatar" loading="lazy" />
              <div v-else class="bookmark-avatar placeholder-avatar">{{ (bm.authorName || '?')[0] }}</div>
            </a>
            <div class="bookmark-body">
              <div class="bookmark-header">
                <a :href="'https://x.com/' + (bm.authorHandle || '_')" target="_blank" class="bookmark-author">{{ bm.authorName || 'Unknown' }}</a>
                <a :href="'https://x.com/' + (bm.authorHandle || '_')" target="_blank" class="bookmark-handle">@{{ bm.authorHandle || '?' }}</a>
                <span class="bookmark-date-sep">·</span>
                <a :href="bm.tweetUrl" target="_blank" class="bookmark-date">{{ formatDate(bm.bookmarkedAt || bm.createdAt) }}</a>
              </div>

              <a :href="bm.tweetUrl" target="_blank" class="bookmark-text-link">
                <div v-if="bm.noteText" class="bookmark-text note-text">
                  <span class="note-badge">Article</span>
                  {{ truncateText(bm.noteText, 500) }}
                </div>
                <div v-else-if="bm.text" class="bookmark-text">{{ bm.text }}</div>
                <div v-else class="bookmark-text empty-text">[No text content]</div>
              </a>

              <!-- Media -->
              <div v-if="getMediaItems(bm).length" class="bookmark-media" :class="'media-count-' + Math.min(getMediaItems(bm).length, 4)">
                <div v-for="(media, i) in getMediaItems(bm).slice(0, 4)" :key="i" class="media-item" @click="openMedia(bm, i)">
                  <img :src="media.thumbnail" loading="lazy" />
                  <div v-if="media.type === 'video'" class="video-badge">▶</div>
                  <div v-if="media.type === 'animated_gif'" class="video-badge">GIF</div>
                </div>
              </div>

              <!-- External URLs -->
              <div v-if="bm.urls?.length" class="bookmark-urls">
                <a v-for="(url, i) in bm.urls.slice(0, 3)" :key="i" :href="url" target="_blank" class="external-url">
                  🔗 {{ shortenUrl(url) }}
                </a>
              </div>

              <!-- Stats -->
              <div class="bookmark-stats">
                <span v-if="bm.replyCount" title="Replies">💬 {{ formatNum(bm.replyCount) }}</span>
                <span v-if="bm.retweetCount" title="Reposts">🔁 {{ formatNum(bm.retweetCount) }}</span>
                <span v-if="bm.likeCount" title="Likes">❤️ {{ formatNum(bm.likeCount) }}</span>
                <span v-if="bm.viewCount" title="Views">👁️ {{ formatNum(bm.viewCount) }}</span>
                <span v-if="bm.bookmarkCount" title="Bookmarks">🔖 {{ formatNum(bm.bookmarkCount) }}</span>
              </div>

              <!-- Tags -->
              <div v-if="bm.tags?.length" class="bookmark-tags">
                <span v-for="t in bm.tags" :key="t" class="tag-badge" :style="getTagStyle(t)">
                  #{{ t }}
                  <button class="tag-remove" @click="removeTag(bm.id, t)">×</button>
                </span>
              </div>

              <!-- Notes -->
              <div v-if="bm.notes" class="bookmark-notes">
                <span class="notes-label">Note:</span> {{ bm.notes }}
              </div>

              <!-- Footer: categories + actions -->
              <div class="bookmark-footer">
                <div class="bookmark-categories">
                  <span v-for="cat in (bm.categories || [])" :key="cat" class="category-tag" :style="getCategoryStyle(cat)">
                    {{ cat }}
                    <button class="tag-remove" @click="removeCategory(bm.id, cat)">×</button>
                  </span>
                </div>
                <div class="bookmark-actions">
                  <div class="category-dropdown">
                    <button class="icon-btn" title="Add category" @click="toggleDropdown(bm.id, 'cat')">🏷️</button>
                    <div v-if="openDropdownId === bm.id && dropdownType === 'cat'" class="category-dropdown-menu">
                      <div v-for="cat in categories" :key="cat.name" class="category-dropdown-item" :class="{ assigned: bm.categories?.includes(cat.name) }" @click="addCategory(bm.id, cat.name)">
                        <span class="category-dot" :style="{ background: cat.color }"></span>
                        {{ cat.name }}
                      </div>
                      <div class="category-dropdown-item" @click="promptNewCategory(bm.id)">+ New category...</div>
                    </div>
                  </div>
                  <div class="category-dropdown">
                    <button class="icon-btn" title="Add tag" @click="toggleDropdown(bm.id, 'tag')">#</button>
                    <div v-if="openDropdownId === bm.id && dropdownType === 'tag'" class="category-dropdown-menu">
                      <div v-for="tag in tags" :key="tag.name" class="category-dropdown-item" :class="{ assigned: bm.tags?.includes(tag.name) }" @click="addTag(bm.id, tag.name)">
                        <span class="tag-dot" :style="{ background: tag.color }"></span>
                        #{{ tag.name }}
                      </div>
                      <div class="category-dropdown-item" @click="promptNewTag(bm.id)">+ New tag...</div>
                    </div>
                  </div>
                  <div class="category-dropdown">
                    <button class="icon-btn" title="Add to collection" @click="toggleDropdown(bm.id, 'col')">📚</button>
                    <div v-if="openDropdownId === bm.id && dropdownType === 'col'" class="category-dropdown-menu">
                      <div v-for="col in collections" :key="col.id" class="category-dropdown-item" @click="addToCollection(col.id, bm.id)">
                        📚 {{ col.name }}
                      </div>
                      <div v-if="collections.length === 0" class="category-dropdown-item" style="color:var(--text-muted)">No collections yet</div>
                    </div>
                  </div>
                  <button class="icon-btn" title="Add note" @click="editNote(bm)">📝</button>
                  <a :href="bm.tweetUrl" target="_blank" class="icon-btn" title="Open on X">↗</a>
                  <button class="icon-btn" title="Delete" @click="deleteBookmark(bm.id)">🗑️</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-state">
          <h3>No bookmarks yet</h3>
          <p>Click "Sync" to start importing your X bookmarks</p>
        </div>

        <!-- Load More -->
        <div v-if="bookmarks.length < total" ref="scrollTrigger" class="load-more">
          <span class="spinner"></span> Loading more...
        </div>
        <div v-else-if="bookmarks.length > 0" class="load-more-end">
          All {{ total }} bookmarks loaded
        </div>
      </template>
    </main>

    <!-- Media Lightbox -->
    <div v-if="lightbox.visible" class="lightbox-overlay" @click.self="closeLightbox">
      <button class="lightbox-close" @click="closeLightbox">×</button>
      <button v-if="lightbox.items.length > 1 && lightbox.index > 0" class="lightbox-nav lightbox-prev" @click="lightbox.index--">‹</button>
      <button v-if="lightbox.items.length > 1 && lightbox.index < lightbox.items.length - 1" class="lightbox-nav lightbox-next" @click="lightbox.index++">›</button>
      <div class="lightbox-content">
        <video v-if="lightbox.items[lightbox.index]?.type === 'video' || lightbox.items[lightbox.index]?.type === 'animated_gif'" :src="lightbox.items[lightbox.index].videoUrl" controls autoplay :loop="lightbox.items[lightbox.index]?.type === 'animated_gif'" class="lightbox-video"></video>
        <img v-else :src="lightbox.items[lightbox.index]?.url" class="lightbox-image" />
      </div>
    </div>

    <!-- Export Modal -->
    <div v-if="showExportModal" class="modal-overlay" @click.self="showExportModal = false">
      <div class="modal">
        <h2 class="modal-title">Export Bookmarks</h2>
        <p style="color:var(--text-secondary);margin-bottom:16px;font-size:14px">Choose a format. JSON is best for AI processing and re-importing.</p>
        <div class="export-options">
          <button class="btn btn-primary" @click="exportData('json')">JSON</button>
          <button class="btn btn-secondary" @click="exportData('csv')">CSV</button>
          <button class="btn btn-secondary" @click="exportData('markdown')">Markdown</button>
        </div>
        <div class="form-group" style="margin-top:16px">
          <label class="form-label">Category filter</label>
          <select v-model="exportCategory" class="form-input">
            <option value="all">All categories</option>
            <option value="uncategorized">Uncategorized only</option>
            <option v-for="cat in categories" :key="cat.name" :value="cat.name">{{ cat.name }}</option>
          </select>
        </div>
        <button class="btn btn-secondary" style="margin-top:12px" @click="showExportModal = false">Cancel</button>
      </div>
    </div>

    <!-- Category Manager Modal -->
    <div v-if="showCategoryModal" class="modal-overlay" @click.self="showCategoryModal = false">
      <div class="modal">
        <h2 class="modal-title">Manage Categories</h2>
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <input v-model="newCategoryName" class="form-input" placeholder="New category name..." @keyup.enter="createCategory" />
          <button class="btn btn-primary btn-sm" @click="createCategory">Add</button>
        </div>
        <div class="category-list">
          <div v-for="cat in categories" :key="cat.name" class="category-list-item">
            <span class="category-dot" :style="{ background: cat.color }"></span>
            <span class="name">{{ cat.name }}</span>
            <div class="actions">
              <button class="icon-btn" title="Rename" @click="renameCategoryPrompt(cat.name)">✏️</button>
              <button class="icon-btn" title="Delete" @click="deleteCategoryConfirm(cat.name)">🗑️</button>
            </div>
          </div>
          <div v-if="categories.length === 0" style="color:var(--text-muted);text-align:center;padding:20px">No categories yet.</div>
        </div>
        <button class="btn btn-secondary" style="margin-top:16px" @click="showCategoryModal = false">Close</button>
      </div>
    </div>

    <!-- Tag Manager Modal -->
    <div v-if="showTagModal" class="modal-overlay" @click.self="showTagModal = false">
      <div class="modal">
        <h2 class="modal-title">Manage Tags</h2>
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <input v-model="newTagName" class="form-input" placeholder="New tag name..." @keyup.enter="createTag" />
          <button class="btn btn-primary btn-sm" @click="createTag">Add</button>
        </div>
        <div class="category-list">
          <div v-for="tag in tags" :key="tag.name" class="category-list-item">
            <span class="tag-dot" :style="{ background: tag.color }"></span>
            <span class="name">#{{ tag.name }}</span>
            <div class="actions">
              <button class="icon-btn" title="Rename" @click="renameTagPrompt(tag.name)">✏️</button>
              <button class="icon-btn" title="Delete" @click="deleteTagConfirm(tag.name)">🗑️</button>
            </div>
          </div>
          <div v-if="tags.length === 0" style="color:var(--text-muted);text-align:center;padding:20px">No tags yet.</div>
        </div>
        <button class="btn btn-secondary" style="margin-top:16px" @click="showTagModal = false">Close</button>
      </div>
    </div>

    <!-- Create Collection Modal -->
    <div v-if="showCreateCollectionModal" class="modal-overlay" @click.self="showCreateCollectionModal = false">
      <div class="modal">
        <h2 class="modal-title">Create Collection</h2>
        <div class="form-group">
          <label class="form-label">Name</label>
          <input v-model="newCollectionName" class="form-input" placeholder="Collection name..." @keyup.enter="createCollection" />
        </div>
        <div class="form-group">
          <label class="form-label">Description (optional)</label>
          <textarea v-model="newCollectionDesc" class="form-input" rows="2" placeholder="What's this collection about?"></textarea>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-secondary" @click="showCreateCollectionModal = false">Cancel</button>
          <button class="btn btn-primary" @click="createCollection">Create</button>
        </div>
      </div>
    </div>

    <!-- Settings Modal -->
    <div v-if="showSettingsModal" class="modal-overlay" @click.self="showSettingsModal = false">
      <div class="modal">
        <h2 class="modal-title">Settings</h2>
        <div class="form-group">
          <label class="form-label">Auto-sync interval (minutes)</label>
          <select v-model="autoSyncInterval" class="form-input" @change="updateAutoSync">
            <option :value="0">Disabled</option>
            <option :value="15">Every 15 minutes</option>
            <option :value="30">Every 30 minutes</option>
            <option :value="60">Every hour</option>
            <option :value="120">Every 2 hours</option>
            <option :value="360">Every 6 hours</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Keyboard Shortcuts</label>
          <div class="shortcuts-list">
            <div class="shortcut-item"><kbd>/</kbd> Focus search</div>
            <div class="shortcut-item"><kbd>j</kbd> / <kbd>k</kbd> Navigate bookmarks</div>
            <div class="shortcut-item"><kbd>x</kbd> Toggle selection</div>
            <div class="shortcut-item"><kbd>o</kbd> Open on X</div>
            <div class="shortcut-item"><kbd>Esc</kbd> Close modal / lightbox</div>
            <div class="shortcut-item"><kbd>←</kbd> / <kbd>→</kbd> Lightbox navigation</div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Offline Reading</label>
          <p style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">
            Cache images and media for offline browsing. Current cache: {{ cacheInfo.count || 0 }} files ({{ cacheInfo.totalSizeMB || 0 }} MB)
          </p>
          <div style="display:flex;gap:8px">
            <button class="btn btn-primary btn-sm" :disabled="cachingInProgress" @click="cacheAllMedia">
              {{ cachingInProgress ? `Caching... ${cacheProgress}` : 'Cache All Media' }}
            </button>
            <button class="btn btn-secondary btn-sm" @click="clearMediaCache">Clear Cache</button>
          </div>
        </div>
        <button class="btn btn-secondary" style="margin-top:16px" @click="showSettingsModal = false">Close</button>
      </div>
    </div>

    <!-- Share Modal -->
    <div v-if="showShareModal" class="modal-overlay" @click.self="showShareModal = false">
      <div class="modal">
        <h2 class="modal-title">Share Collection</h2>
        <p style="color:var(--text-secondary);margin-bottom:16px;font-size:14px">
          Generate a shareable summary of your collection as text or image.
        </p>
        <div class="form-group">
          <label class="form-label">Format</label>
          <div class="export-options">
            <button class="btn btn-primary" @click="shareAsText">Copy as Text</button>
            <button class="btn btn-secondary" @click="shareAsMarkdown">Copy as Markdown</button>
          </div>
        </div>
        <div v-if="shareContent" class="form-group" style="margin-top:16px">
          <textarea class="form-input" rows="8" readonly :value="shareContent"></textarea>
          <p style="color:var(--success);font-size:13px;margin-top:4px">Copied to clipboard!</p>
        </div>
        <button class="btn btn-secondary" style="margin-top:12px" @click="showShareModal = false">Close</button>
      </div>
    </div>

    <!-- Note Editor Modal -->
    <div v-if="showNoteModal" class="modal-overlay" @click.self="closeNoteModal">
      <div class="modal">
        <h2 class="modal-title">Edit Note</h2>
        <textarea v-model="editingNote" class="form-input" rows="4" placeholder="Add a note for this bookmark..."></textarea>
        <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end">
          <button class="btn btn-secondary" @click="closeNoteModal">Cancel</button>
          <button class="btn btn-primary" @click="saveNote">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { getDB, loadMockData, runDBTests } from './db.js'

// --- State ---
const bookmarks = ref([])
const categories = ref([])
const tags = ref([])
const collections = ref([])
const stats = reactive({ bookmarkCount: 0, lastSyncTime: null })
const statsData = ref({})
const duplicates = ref([])
const currentView = ref('all')
const searchQuery = ref('')
const syncState = ref('idle')
const syncMessage = ref('')
const total = ref(0)
const selectedIds = ref(new Set())
const openDropdownId = ref(null)
const dropdownType = ref('cat')
const scrollTrigger = ref(null)
const loadingMore = ref(false)
const pageSize = 50
const showAdvancedSearch = ref(false)
const autoSyncInterval = ref(30)
const focusedIndex = ref(-1)

// Filters
const filters = reactive({ author: '', dateFrom: '', dateTo: '', mediaType: '' })

// Modals
const showExportModal = ref(false)
const showCategoryModal = ref(false)
const showTagModal = ref(false)
const showCreateCollectionModal = ref(false)
const showSettingsModal = ref(false)
const showShareModal = ref(false)
const showNoteModal = ref(false)
const exportCategory = ref('all')

// Category/tag manager
const newCategoryName = ref('')
const newTagName = ref('')
const newCollectionName = ref('')
const newCollectionDesc = ref('')

// Note editor
const editingBookmarkId = ref(null)
const editingNote = ref('')

// Share
const shareContent = ref('')

// Offline cache
const cacheInfo = ref({ count: 0, totalSizeMB: '0' })
const cachingInProgress = ref(false)
const cacheProgress = ref('')

// Lightbox
const lightbox = reactive({ visible: false, items: [], index: 0 })

// Computed
const viewTitle = computed(() => {
  if (currentView.value === 'all') return 'All Bookmarks'
  if (currentView.value === 'uncategorized') return 'Uncategorized'
  if (currentView.value.startsWith('category:')) return currentView.value.slice(9)
  if (currentView.value.startsWith('tag:')) return '#' + currentView.value.slice(4)
  if (currentView.value.startsWith('collection:')) {
    const col = collections.value.find(c => c.id === parseInt(currentView.value.slice(11)))
    return col?.name || 'Collection'
  }
  return 'Bookmarks'
})

const maxTimelineCount = computed(() => {
  if (!statsData.value.timeline?.length) return 1
  return Math.max(...statsData.value.timeline.map(d => d.count), 1)
})

// --- View switching ---
function switchView(view) {
  currentView.value = view
  if (view === 'stats') loadStatsData()
  else if (view === 'duplicates') { /* wait for user to click scan */ }
  else loadBookmarks()
}

// --- Search ---
let searchTimer = null
function debouncedSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { loadBookmarks() }, 300)
}

function clearFilters() {
  filters.author = ''; filters.dateFrom = ''; filters.dateTo = ''; filters.mediaType = ''
  loadBookmarks()
}

// --- Formatting ---
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
  let hours = d.getHours()
  const minutes = d.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'pm' : 'am'
  hours = hours % 12 || 12
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${hours}:${minutes} ${ampm} · ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

function truncateText(text, maxLen) {
  if (!text) return ''
  if (text.length <= maxLen) return text
  return text.substring(0, maxLen) + '...'
}

function shortenUrl(url) {
  try {
    const u = new URL(url)
    let path = u.pathname + u.search
    if (path.length > 40) path = path.substring(0, 37) + '...'
    return u.hostname + path
  } catch { return url.substring(0, 50) }
}

// --- Media helpers ---
function getMediaItems(bm) {
  const items = []
  const mediaUrls = bm.mediaUrls || []
  const mediaTypes = bm.mediaTypes || []
  const videoUrls = bm.videoUrls || []
  let videoIdx = 0

  for (let i = 0; i < mediaUrls.length; i++) {
    const type = mediaTypes[i] || 'photo'
    const thumbUrl = mediaUrls[i]
    let highResUrl = thumbUrl
    if (type === 'photo' && thumbUrl.includes('pbs.twimg.com')) {
      const base = thumbUrl.split('?')[0]
      highResUrl = base + '?format=jpg&name=4096x4096'
    }
    const item = { thumbnail: thumbUrl, type, url: highResUrl }
    if (type === 'video' || type === 'animated_gif') {
      item.videoUrl = videoUrls[videoIdx] || ''
      videoIdx++
    }
    items.push(item)
  }
  return items
}

function openMedia(bm, index) {
  lightbox.items = getMediaItems(bm)
  lightbox.index = index
  lightbox.visible = true
}

function closeLightbox() { lightbox.visible = false }

// --- Data loading ---
async function loadBookmarks() {
  const db = await getDB()
  const params = {
    offset: 0,
    limit: pageSize,
    sort: 'bookmarkedAt',
    order: 'desc',
    search: searchQuery.value || null,
    author: filters.author || null,
    dateFrom: filters.dateFrom || null,
    dateTo: filters.dateTo || null,
    hasMedia: filters.mediaType === 'media' ? true : null,
    hasVideo: filters.mediaType === 'video' ? true : null,
  }

  if (currentView.value === 'all') { /* no filter */ }
  else if (currentView.value === 'uncategorized') params.category = 'uncategorized'
  else if (currentView.value.startsWith('category:')) params.category = currentView.value.slice(9)
  else if (currentView.value.startsWith('tag:')) params.tag = currentView.value.slice(4)
  else if (currentView.value.startsWith('collection:')) params.collectionId = parseInt(currentView.value.slice(11))

  const result = await db.getBookmarks(params)
  bookmarks.value = result.results
  total.value = result.total
}

async function loadMore() {
  if (loadingMore.value || bookmarks.value.length >= total.value) return
  loadingMore.value = true
  const db = await getDB()
  const params = {
    offset: bookmarks.value.length,
    limit: pageSize,
    sort: 'bookmarkedAt',
    order: 'desc',
    search: searchQuery.value || null,
    author: filters.author || null,
    dateFrom: filters.dateFrom || null,
    dateTo: filters.dateTo || null,
    hasMedia: filters.mediaType === 'media' ? true : null,
    hasVideo: filters.mediaType === 'video' ? true : null,
  }

  if (currentView.value === 'all') { /* no filter */ }
  else if (currentView.value === 'uncategorized') params.category = 'uncategorized'
  else if (currentView.value.startsWith('category:')) params.category = currentView.value.slice(9)
  else if (currentView.value.startsWith('tag:')) params.tag = currentView.value.slice(4)
  else if (currentView.value.startsWith('collection:')) params.collectionId = parseInt(currentView.value.slice(11))

  const result = await db.getBookmarks(params)
  bookmarks.value = [...bookmarks.value, ...result.results]
  total.value = result.total
  loadingMore.value = false
}

async function loadCategories() {
  const db = await getDB()
  categories.value = await db.getAllCategories()
}

async function loadTags() {
  const db = await getDB()
  tags.value = await db.getAllTags()
}

async function loadCollections() {
  const db = await getDB()
  collections.value = await db.getAllCollections()
}

async function loadStats() {
  const db = await getDB()
  stats.bookmarkCount = await db.getBookmarkCount()
  stats.lastSyncTime = await db.getSyncState('lastSyncTime')
}

async function loadStatsData() {
  const db = await getDB()
  statsData.value = await db.getStats()
}

// --- Sync ---
function startSync(fullSync) {
  syncState.value = 'syncing'
  syncMessage.value = fullSync ? 'Starting full sync...' : 'Starting incremental sync...'
  chrome.runtime.sendMessage({ type: 'START_SYNC', fullSync }, (response) => {
    if (chrome.runtime.lastError) {
      syncState.value = 'error'
      syncMessage.value = chrome.runtime.lastError.message
      return
    }
    if (response?.status === 'completed') {
      syncState.value = 'completed'
      syncMessage.value = `Sync complete. ${response.newCount} new bookmarks.`
      loadBookmarks(); loadStats()
    } else if (response?.status === 'error') {
      syncState.value = 'error'
      syncMessage.value = response.message
    }
  })
}

function dismissStatus() { syncState.value = 'idle'; syncMessage.value = '' }

function handleSyncMessage(message) {
  if (message.type === 'SYNC_STATUS_UPDATE') {
    syncState.value = message.state
    syncMessage.value = message.message
    if (message.state === 'completed') { loadBookmarks(); loadStats() }
  }
  if (message.type === 'CONTEXT_MENU_ACTION') {
    // Handle context menu action from background
    if (message.action === 'addTag') {
      const name = prompt('Tag name to add:')
      if (name) {
        getDB().then(async db => {
          const existing = await db.tags.where('name').equals(name).first()
          if (!existing) await db.addTag(name)
          await db.addTagToBookmark(message.bookmarkId, name)
          loadBookmarks(); loadTags()
        })
      }
    } else if (message.action === 'addCategory') {
      const name = prompt('Category name to add:')
      if (name) {
        getDB().then(async db => {
          const existing = await db.categories.where('name').equals(name).first()
          if (!existing) await db.addCategory(name)
          await db.addCategoryToBookmark(message.bookmarkId, name)
          loadBookmarks(); loadCategories()
        })
      }
    }
  }
}

// --- Category operations ---
function getCategoryStyle(catName) {
  const cat = categories.value.find(c => c.name === catName)
  if (cat) return { color: cat.color, borderColor: cat.color, background: cat.color + '20' }
  return { color: 'var(--text-secondary)', borderColor: 'var(--border)', background: 'transparent' }
}

function getTagStyle(tagName) {
  const tag = tags.value.find(t => t.name === tagName)
  if (tag) return { color: tag.color, borderColor: tag.color, background: tag.color + '15' }
  return { color: 'var(--text-secondary)', borderColor: 'var(--border)', background: 'transparent' }
}

async function addCategory(bookmarkId, catName) {
  const db = await getDB()
  await db.addCategoryToBookmark(bookmarkId, catName)
  openDropdownId.value = null
  await loadBookmarks()
}

async function removeCategory(bookmarkId, catName) {
  const db = await getDB()
  await db.removeCategoryFromBookmark(bookmarkId, catName)
  await loadBookmarks()
}

async function addTag(bookmarkId, tagName) {
  const db = await getDB()
  await db.addTagToBookmark(bookmarkId, tagName)
  openDropdownId.value = null
  await loadBookmarks()
}

async function removeTag(bookmarkId, tagName) {
  const db = await getDB()
  await db.removeTagFromBookmark(bookmarkId, tagName)
  await loadBookmarks()
}

async function addToCollection(collectionId, bookmarkId) {
  const db = await getDB()
  await db.addBookmarkToCollection(collectionId, bookmarkId)
  openDropdownId.value = null
}

async function createCategory() {
  const name = newCategoryName.value.trim()
  if (!name) return
  try {
    const db = await getDB()
    await db.addCategory(name)
    newCategoryName.value = ''
    await loadCategories()
  } catch (e) {
    if (e.name === 'ConstraintError') alert('Category already exists')
  }
}

async function createTag() {
  const name = newTagName.value.trim()
  if (!name) return
  try {
    const db = await getDB()
    await db.addTag(name)
    newTagName.value = ''
    await loadTags()
  } catch (e) {
    if (e.name === 'ConstraintError') alert('Tag already exists')
  }
}

async function createCollection() {
  const name = newCollectionName.value.trim()
  if (!name) return
  const db = await getDB()
  await db.createCollection(name, newCollectionDesc.value.trim())
  newCollectionName.value = ''
  newCollectionDesc.value = ''
  showCreateCollectionModal.value = false
  await loadCollections()
}

async function deleteCategoryConfirm(name) {
  if (!confirm(`Delete category "${name}"?`)) return
  const db = await getDB()
  await db.deleteCategory(name)
  if (currentView.value === 'category:' + name) currentView.value = 'all'
  await loadCategories(); await loadBookmarks()
}

async function deleteTagConfirm(name) {
  if (!confirm(`Delete tag "#${name}"?`)) return
  const db = await getDB()
  await db.deleteTag(name)
  if (currentView.value === 'tag:' + name) currentView.value = 'all'
  await loadTags(); await loadBookmarks()
}

function renameCategoryPrompt(name) {
  const newName = prompt('New category name:', name)
  if (!newName || newName === name) return
  getDB().then(db => db.renameCategory(name, newName)).then(() => { loadCategories(); loadBookmarks() })
}

function renameTagPrompt(name) {
  const newName = prompt('New tag name:', name)
  if (!newName || newName === name) return
  getDB().then(db => db.renameTag(name, newName)).then(() => { loadTags(); loadBookmarks() })
}

function toggleDropdown(id, type) {
  if (openDropdownId.value === id && dropdownType.value === type) { openDropdownId.value = null }
  else { openDropdownId.value = id; dropdownType.value = type }
}

async function promptNewCategory(bookmarkId) {
  const name = prompt('New category name:')
  if (!name) return
  const db = await getDB()
  try { await db.addCategory(name) } catch {}
  await db.addCategoryToBookmark(bookmarkId, name)
  openDropdownId.value = null
  await loadCategories(); await loadBookmarks()
}

async function promptNewTag(bookmarkId) {
  const name = prompt('New tag name:')
  if (!name) return
  const db = await getDB()
  try { await db.addTag(name) } catch {}
  await db.addTagToBookmark(bookmarkId, name)
  openDropdownId.value = null
  await loadTags(); await loadBookmarks()
}

// --- Note operations ---
function editNote(bookmark) {
  editingBookmarkId.value = bookmark.id
  editingNote.value = bookmark.notes || ''
  showNoteModal.value = true
}

function closeNoteModal() { showNoteModal.value = false; editingBookmarkId.value = null; editingNote.value = '' }

async function saveNote() {
  if (editingBookmarkId.value) {
    const db = await getDB()
    await db.bookmarks.update(editingBookmarkId.value, { notes: editingNote.value })
    await loadBookmarks()
  }
  closeNoteModal()
}

// --- Selection ---
function toggleSelect(id) {
  const s = new Set(selectedIds.value)
  if (s.has(id)) s.delete(id); else s.add(id)
  selectedIds.value = s
}

function clearSelection() { selectedIds.value = new Set() }

async function bulkCategorize() {
  const catName = prompt('Category name to assign:')
  if (!catName) return
  const db = await getDB()
  if (!categories.value.find(c => c.name === catName)) { await db.addCategory(catName); await loadCategories() }
  for (const id of selectedIds.value) await db.addCategoryToBookmark(id, catName)
  await loadBookmarks(); clearSelection()
}

async function bulkTag() {
  const tagName = prompt('Tag name to assign:')
  if (!tagName) return
  const db = await getDB()
  if (!tags.value.find(t => t.name === tagName)) { await db.addTag(tagName); await loadTags() }
  for (const id of selectedIds.value) await db.addTagToBookmark(id, tagName)
  await loadBookmarks(); clearSelection()
}

async function bulkAddToCollection() {
  if (collections.value.length === 0) { alert('Create a collection first.'); return }
  const name = prompt('Collection name:\n' + collections.value.map(c => c.name).join(', '))
  if (!name) return
  const col = collections.value.find(c => c.name === name)
  if (!col) { alert('Collection not found.'); return }
  const db = await getDB()
  for (const id of selectedIds.value) await db.addBookmarkToCollection(col.id, id)
  clearSelection()
}

async function bulkExport() {
  const db = await getDB()
  const data = []
  for (const id of selectedIds.value) { const bm = await db.bookmarks.get(id); if (bm) data.push(bm) }
  downloadJSON(data, 'selected-bookmarks')
}

// --- Export ---
async function exportData(format) {
  const db = await getDB()
  const cat = exportCategory.value
  let content, filename, mimeType
  if (format === 'json') {
    content = JSON.stringify(await db.exportAsJSON({ category: cat }), null, 2)
    filename = `x-bookmarks-${cat === 'all' ? 'all' : cat}`; mimeType = 'application/json'
  } else if (format === 'csv') {
    content = await db.exportAsCSV({ category: cat })
    filename = `x-bookmarks-${cat === 'all' ? 'all' : cat}`; mimeType = 'text/csv'
  } else if (format === 'markdown') {
    content = await db.exportAsMarkdown({ category: cat })
    filename = `x-bookmarks-${cat === 'all' ? 'all' : cat}`; mimeType = 'text/markdown'
  }
  downloadFile(content, filename, format, mimeType)
  showExportModal.value = false
}

function downloadJSON(data, name) { downloadFile(JSON.stringify(data, null, 2), name, 'json', 'application/json') }

function downloadFile(content, name, ext, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `${name}.${ext}`; a.click()
  URL.revokeObjectURL(url)
}

// --- Share ---
async function shareAsText() {
  const db = await getDB()
  let bms
  if (currentView.value.startsWith('collection:')) {
    const colId = parseInt(currentView.value.slice(11))
    const result = await db.getBookmarks({ collectionId: colId, limit: 1000 })
    bms = result.results
  } else {
    bms = bookmarks.value
  }
  const text = bms.map(b => `@${b.authorHandle}: ${b.text || ''}\n${b.tweetUrl}`).join('\n\n---\n\n')
  shareContent.value = text
  navigator.clipboard.writeText(text).catch(() => {})
}

async function shareAsMarkdown() {
  const db = await getDB()
  let bms
  if (currentView.value.startsWith('collection:')) {
    const colId = parseInt(currentView.value.slice(11))
    const result = await db.getBookmarks({ collectionId: colId, limit: 1000 })
    bms = result.results
  } else {
    bms = bookmarks.value
  }
  const md = bms.map(b => `**@${b.authorHandle}** (${b.authorName})\n\n${b.text || ''}\n\n[Open on X](${b.tweetUrl})`).join('\n\n---\n\n')
  shareContent.value = md
  navigator.clipboard.writeText(md).catch(() => {})
}

// --- Offline Cache ---
async function cacheAllMedia() {
  cachingInProgress.value = true
  cacheProgress.value = '0%'
  const db = await getDB()
  await db.cacheAllMedia((done, total) => {
    cacheProgress.value = `${Math.round(done / total * 100)}%`
  })
  cachingInProgress.value = false
  cacheProgress.value = ''
  await loadCacheInfo()
}

async function clearMediaCache() {
  if (!confirm('Clear all cached media? You will need to re-download for offline use.')) return
  const db = await getDB()
  await db.clearCache()
  await loadCacheInfo()
}

async function loadCacheInfo() {
  const db = await getDB()
  cacheInfo.value = await db.getCacheSize()
}

// --- Duplicates ---
async function scanDuplicates() {
  const db = await getDB()
  duplicates.value = await db.findDuplicates()
}

async function mergeDuplicate(keepId, removeId) {
  const db = await getDB()
  await db.mergeDuplicates(keepId, removeId)
  duplicates.value = duplicates.value.filter(d => d.duplicate.id !== removeId && d.original.id !== removeId)
  await loadStats()
}

// --- Delete ---
async function deleteBookmark(id) {
  if (!confirm('Delete this bookmark from local storage?')) return
  const db = await getDB()
  await db.deleteBookmark(id)
  await loadBookmarks(); await loadStats()
}

// --- Settings ---
async function loadAutoSyncInterval() {
  chrome.runtime.sendMessage({ type: 'GET_AUTO_SYNC_INTERVAL' }, (response) => {
    if (response?.interval !== undefined) autoSyncInterval.value = response.interval
  })
}

function updateAutoSync() {
  chrome.runtime.sendMessage({ type: 'SET_AUTO_SYNC_INTERVAL', interval: autoSyncInterval.value })
}

// --- Mock Data ---
async function handleLoadMockData() {
  try {
    syncState.value = 'syncing'; syncMessage.value = 'Loading mock data...'
    const result = await loadMockData(10)
    syncState.value = 'completed'
    syncMessage.value = `Mock data loaded! ${result.count} bookmarks in DB.`
    await loadBookmarks(); await loadCategories(); await loadTags(); await loadStats()
  } catch (e) { syncState.value = 'error'; syncMessage.value = `Mock data error: ${e.message}` }
}

// --- Keyboard shortcuts ---
function handleKeydown(e) {
  // Lightbox shortcuts
  if (lightbox.visible) {
    if (e.key === 'Escape') closeLightbox()
    if (e.key === 'ArrowLeft' && lightbox.index > 0) lightbox.index--
    if (e.key === 'ArrowRight' && lightbox.index < lightbox.items.length - 1) lightbox.index++
    return
  }

  // Don't trigger shortcuts when typing in inputs
  const tag = e.target.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    if (e.key === 'Escape') e.target.blur()
    return
  }

  // Close modals
  if (e.key === 'Escape') {
    if (showExportModal.value) { showExportModal.value = false; return }
    if (showCategoryModal.value) { showCategoryModal.value = false; return }
    if (showTagModal.value) { showTagModal.value = false; return }
    if (showSettingsModal.value) { showSettingsModal.value = false; return }
    if (showShareModal.value) { showShareModal.value = false; return }
    if (showNoteModal.value) { closeNoteModal(); return }
    if (showCreateCollectionModal.value) { showCreateCollectionModal.value = false; return }
  }

  // Focus search
  if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    document.querySelector('.search-box input')?.focus()
    return
  }

  // Navigate bookmarks with j/k
  if (e.key === 'j') {
    focusedIndex.value = Math.min(focusedIndex.value + 1, bookmarks.value.length - 1)
    scrollToFocused()
    return
  }
  if (e.key === 'k') {
    focusedIndex.value = Math.max(focusedIndex.value - 1, 0)
    scrollToFocused()
    return
  }

  // Toggle selection with x
  if (e.key === 'x' && focusedIndex.value >= 0 && focusedIndex.value < bookmarks.value.length) {
    toggleSelect(bookmarks.value[focusedIndex.value].id)
    return
  }

  // Open on X with o
  if (e.key === 'o' && focusedIndex.value >= 0 && focusedIndex.value < bookmarks.value.length) {
    window.open(bookmarks.value[focusedIndex.value].tweetUrl, '_blank')
    return
  }
}

function scrollToFocused() {
  const items = document.querySelectorAll('.bookmark-item')
  if (items[focusedIndex.value]) {
    items[focusedIndex.value].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    // Highlight
    items.forEach(el => el.classList.remove('focused'))
    items[focusedIndex.value].classList.add('focused')
  }
}

// --- Watchers ---
watch(currentView, () => {
  if (currentView.value !== 'stats' && currentView.value !== 'duplicates') loadBookmarks()
})

function handleClickOutside(e) {
  if (openDropdownId.value && !e.target.closest('.category-dropdown')) openDropdownId.value = null
}

// --- Infinite scroll ---
let scrollObserver = null

function setupScrollObserver() {
  if (scrollObserver) scrollObserver.disconnect()
  scrollObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) loadMore()
  }, { rootMargin: '200px' })
}

watch(scrollTrigger, (el) => {
  if (el && scrollObserver) scrollObserver.observe(el)
}, { flush: 'post' })

// --- Lifecycle ---
onMounted(() => {
  loadBookmarks(); loadCategories(); loadTags(); loadCollections(); loadStats(); loadAutoSyncInterval(); loadCacheInfo()
  chrome.runtime.onMessage.addListener(handleSyncMessage)
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
  setupScrollObserver()
})

onUnmounted(() => {
  chrome.runtime.onMessage.removeListener(handleSyncMessage)
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
  if (scrollObserver) scrollObserver.disconnect()
})
</script>

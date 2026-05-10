// db.js - Dexie database module for X Bookmark Sync

import Dexie from 'dexie';

const DB_NAME = 'XBookmarkSync';
const DB_VERSION = 3;

class BookmarkDB extends Dexie {
  constructor() {
    super(DB_NAME);

    this.version(2).stores({
      bookmarks: '++id, tweetId, authorHandle, createdAt, bookmarkedAt, *categories',
      categories: '++id, &name',
      syncState: 'key'
    });

    this.version(3).stores({
      bookmarks: '++id, tweetId, authorHandle, createdAt, bookmarkedAt, *categories, *tags',
      categories: '++id, &name',
      tags: '++id, &name',
      collections: '++id, &name, createdAt',
      cachedMedia: '&url',
      syncState: 'key'
    });

    this.bookmarks = this.table('bookmarks');
    this.categories = this.table('categories');
    this.tags = this.table('tags');
    this.collections = this.table('collections');
    this.cachedMedia = this.table('cachedMedia');
    this.syncState = this.table('syncState');
  }

  // --- Sync State Helpers ---

  async getSyncState(key) {
    const record = await this.syncState.get(key);
    return record?.value;
  }

  async setSyncState(key, value) {
    await this.syncState.put({ key, value });
  }

  // --- Bookmark Operations ---

  async upsertBookmark(tweetData) {
    const existing = await this.bookmarks.where('tweetId').equals(tweetData.tweetId).first();
    if (existing) {
      const merged = {
        ...tweetData,
        categories: [...new Set([...(existing.categories || []), ...(tweetData.categories || [])])],
        notes: existing.notes || tweetData.notes,
        isRead: existing.isRead || tweetData.isRead,
      };
      await this.bookmarks.update(existing.id, merged);
      return existing.id;
    } else {
      return await this.bookmarks.add(tweetData);
    }
  }

  async upsertBookmarks(tweetDataList) {
    const results = [];
    for (const tweetData of tweetDataList) {
      const id = await this.upsertBookmark(tweetData);
      results.push(id);
    }
    return results;
  }

  async getBookmarks({ offset = 0, limit = 50, category = null, search = null, sort = 'bookmarkedAt', order = 'desc', tag = null, collectionId = null, dateFrom = null, dateTo = null, author = null, hasMedia = null, hasVideo = null } = {}) {
    let collection = this.bookmarks.orderBy(sort);

    if (order === 'desc') {
      collection = collection.reverse();
    }

    let results = await collection.toArray();

    if (category && category !== 'all') {
      if (category === 'uncategorized') {
        results = results.filter(b => !b.categories || b.categories.length === 0);
      } else {
        results = results.filter(b => b.categories?.includes(category));
      }
    }

    if (tag) {
      results = results.filter(b => b.tags?.includes(tag));
    }

    if (collectionId) {
      const col = await this.collections.get(collectionId);
      if (col?.bookmarkIds) {
        const idSet = new Set(col.bookmarkIds);
        results = results.filter(b => idSet.has(b.id));
      }
    }

    // Advanced filters
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      results = results.filter(b => new Date(b.bookmarkedAt || b.createdAt).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86400000; // include entire day
      results = results.filter(b => new Date(b.bookmarkedAt || b.createdAt).getTime() <= to);
    }
    if (author) {
      const a = author.toLowerCase();
      results = results.filter(b => b.authorHandle?.toLowerCase().includes(a) || b.authorName?.toLowerCase().includes(a));
    }
    if (hasMedia === true) {
      results = results.filter(b => b.mediaUrls?.length > 0);
    }
    if (hasVideo === true) {
      results = results.filter(b => b.videoUrls?.length > 0);
    }

    if (search) {
      const keywords = search.toLowerCase().split(/\s+/).filter(k => k.length > 0);
      results = results.filter(b => {
        const haystack = [
          b.text,
          b.noteText,
          b.fullText,
          b.authorName,
          b.authorHandle,
          (b.urls || []).join(' '),
          (b.categories || []).join(' '),
          (b.tags || []).join(' '),
          b.notes,
        ].filter(Boolean).join(' ').toLowerCase();
        return keywords.every(k => haystack.includes(k));
      });
    }

    const total = results.length;
    results = results.slice(offset, offset + limit);
    return { results, total };
  }

  async addCategoryToBookmark(bookmarkId, categoryName) {
    const bookmark = await this.bookmarks.get(bookmarkId);
    if (!bookmark) return;
    const categories = [...new Set([...(bookmark.categories || []), categoryName])];
    await this.bookmarks.update(bookmarkId, { categories });
  }

  async removeCategoryFromBookmark(bookmarkId, categoryName) {
    const bookmark = await this.bookmarks.get(bookmarkId);
    if (!bookmark) return;
    const categories = (bookmark.categories || []).filter(c => c !== categoryName);
    await this.bookmarks.update(bookmarkId, { categories });
  }

  async deleteBookmark(bookmarkId) {
    await this.bookmarks.delete(bookmarkId);
  }

  async getBookmarkCount() {
    return await this.bookmarks.count();
  }

  // --- Category Operations ---

  async getAllCategories() {
    return await this.categories.orderBy('name').toArray();
  }

  async addCategory(name, color = null) {
    if (!color) {
      const colors = ['#1d9bf0', '#f91880', '#ffd400', '#00ba7c', '#7856ff', '#ff7a00', '#e0245e', '#17bf63'];
      const existing = await this.categories.count();
      color = colors[existing % colors.length];
    }
    return await this.categories.add({ name, color, createdAt: new Date().toISOString() });
  }

  async deleteCategory(name) {
    await this.categories.where('name').equals(name).delete();
    const bookmarks = await this.bookmarks.where('categories').equals(name).toArray();
    for (const b of bookmarks) {
      const categories = (b.categories || []).filter(c => c !== name);
      await this.bookmarks.update(b.id, { categories });
    }
  }

  async renameCategory(oldName, newName) {
    const cat = await this.categories.where('name').equals(oldName).first();
    if (cat) {
      await this.categories.update(cat.id, { name: newName });
    }
    const bookmarks = await this.bookmarks.where('categories').equals(oldName).toArray();
    for (const b of bookmarks) {
      const categories = (b.categories || []).map(c => c === oldName ? newName : c);
      await this.bookmarks.update(b.id, { categories });
    }
  }

  // --- Export Operations ---

  async exportAsJSON({ category = null, includeCategories = true } = {}) {
    let bookmarks;
    if (category && category !== 'all') {
      if (category === 'uncategorized') {
        bookmarks = await this.bookmarks.filter(b => !b.categories || b.categories.length === 0).toArray();
      } else {
        bookmarks = await this.bookmarks.where('categories').equals(category).toArray();
      }
    } else {
      bookmarks = await this.bookmarks.toArray();
    }

    return bookmarks.map(b => ({
      tweetId: b.tweetId,
      text: b.text,
      noteText: b.noteText || null,
      author: { name: b.authorName, handle: b.authorHandle, avatar: b.authorAvatarUrl },
      url: b.tweetUrl,
      mediaUrls: b.mediaUrls || [],
      videoUrls: b.videoUrls || [],
      createdAt: b.createdAt,
      bookmarkedAt: b.bookmarkedAt,
      ...(includeCategories ? { categories: b.categories || [], notes: b.notes || '' } : {}),
      stats: { likes: b.likeCount || 0, retweets: b.retweetCount || 0, replies: b.replyCount || 0, bookmarks: b.bookmarkCount || 0, views: b.viewCount || 0 }
    }));
  }

  async exportAsCSV({ category = null } = {}) {
    const data = await this.exportAsJSON({ category });
    if (data.length === 0) return '';

    const headers = ['tweetId', 'text', 'authorName', 'authorHandle', 'url', 'createdAt', 'bookmarkedAt', 'categories', 'notes', 'likes', 'retweets', 'replies'];
    const escape = (str) => {
      if (!str) return '';
      const s = String(str).replace(/"/g, '""');
      return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s}"` : s;
    };

    const rows = data.map(b => [
      escape(b.tweetId), escape(b.text), escape(b.author?.name), escape(b.author?.handle),
      escape(b.url), escape(b.createdAt), escape(b.bookmarkedAt),
      escape((b.categories || []).join('; ')), escape(b.notes),
      escape(b.stats?.likes), escape(b.stats?.retweets), escape(b.stats?.replies),
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  async exportAsMarkdown({ category = null } = {}) {
    const data = await this.exportAsJSON({ category });
    let md = `# X/Twitter Bookmarks Export\n\n`;
    md += `Exported: ${new Date().toISOString()}\n`;
    md += `Total: ${data.length} bookmarks\n\n---\n\n`;

    for (const b of data) {
      md += `## @${b.author?.handle || 'unknown'} (${b.author?.name || ''})\n\n`;
      md += `${b.text || ''}\n\n`;
      md += `- **URL**: ${b.url || ''}\n`;
      md += `- **Created**: ${b.createdAt || ''}\n`;
      md += `- **Bookmarked**: ${b.bookmarkedAt || ''}\n`;
      if (b.categories?.length) md += `- **Categories**: ${b.categories.join(', ')}\n`;
      if (b.notes) md += `- **Notes**: ${b.notes}\n`;
      if (b.mediaUrls?.length) md += `- **Media**: ${b.mediaUrls.join(', ')}\n`;
      md += `\n---\n\n`;
    }

    return md;
  }

  // --- Tag Operations ---

  async getAllTags() {
    return await this.tags.orderBy('name').toArray();
  }

  async addTag(name, color = null) {
    if (!color) {
      const colors = ['#1d9bf0', '#f91880', '#ffd400', '#00ba7c', '#7856ff', '#ff7a00', '#e0245e', '#17bf63', '#794bc4', '#f45d22'];
      const existing = await this.tags.count();
      color = colors[existing % colors.length];
    }
    return await this.tags.add({ name, color, createdAt: new Date().toISOString() });
  }

  async deleteTag(name) {
    await this.tags.where('name').equals(name).delete();
    const bookmarks = await this.bookmarks.where('tags').equals(name).toArray();
    for (const b of bookmarks) {
      const tags = (b.tags || []).filter(t => t !== name);
      await this.bookmarks.update(b.id, { tags });
    }
  }

  async renameTag(oldName, newName) {
    const tag = await this.tags.where('name').equals(oldName).first();
    if (tag) await this.tags.update(tag.id, { name: newName });
    const bookmarks = await this.bookmarks.where('tags').equals(oldName).toArray();
    for (const b of bookmarks) {
      const tags = (b.tags || []).map(t => t === oldName ? newName : t);
      await this.bookmarks.update(b.id, { tags });
    }
  }

  async addTagToBookmark(bookmarkId, tagName) {
    const bookmark = await this.bookmarks.get(bookmarkId);
    if (!bookmark) return;
    const tags = [...new Set([...(bookmark.tags || []), tagName])];
    await this.bookmarks.update(bookmarkId, { tags });
  }

  async removeTagFromBookmark(bookmarkId, tagName) {
    const bookmark = await this.bookmarks.get(bookmarkId);
    if (!bookmark) return;
    const tags = (bookmark.tags || []).filter(t => t !== tagName);
    await this.bookmarks.update(bookmarkId, { tags });
  }

  // --- Collection Operations ---

  async getAllCollections() {
    return await this.collections.orderBy('name').toArray();
  }

  async createCollection(name, description = '') {
    return await this.collections.add({
      name,
      description,
      bookmarkIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async updateCollection(id, updates) {
    await this.collections.update(id, { ...updates, updatedAt: new Date().toISOString() });
  }

  async deleteCollection(id) {
    await this.collections.delete(id);
  }

  async addBookmarkToCollection(collectionId, bookmarkId) {
    const col = await this.collections.get(collectionId);
    if (!col) return;
    const ids = [...new Set([...(col.bookmarkIds || []), bookmarkId])];
    await this.collections.update(collectionId, { bookmarkIds: ids, updatedAt: new Date().toISOString() });
  }

  async removeBookmarkFromCollection(collectionId, bookmarkId) {
    const col = await this.collections.get(collectionId);
    if (!col) return;
    const ids = (col.bookmarkIds || []).filter(id => id !== bookmarkId);
    await this.collections.update(collectionId, { bookmarkIds: ids, updatedAt: new Date().toISOString() });
  }

  async getCollectionBookmarkCount(collectionId) {
    const col = await this.collections.get(collectionId);
    return col?.bookmarkIds?.length || 0;
  }

  // --- Stats / Analytics ---

  async getStats() {
    const allBookmarks = await this.bookmarks.toArray();
    const total = allBookmarks.length;
    if (total === 0) return { total: 0, authors: [], categories: [], tags: [], timeline: [], topAuthors: [] };

    // Top authors
    const authorMap = {};
    for (const b of allBookmarks) {
      const handle = b.authorHandle || 'unknown';
      if (!authorMap[handle]) authorMap[handle] = { handle, name: b.authorName || '', count: 0, avatar: b.authorAvatarUrl || '' };
      authorMap[handle].count++;
    }
    const topAuthors = Object.values(authorMap).sort((a, b) => b.count - a.count).slice(0, 20);

    // Category distribution
    const catMap = {};
    let uncategorized = 0;
    for (const b of allBookmarks) {
      if (!b.categories || b.categories.length === 0) { uncategorized++; continue; }
      for (const c of b.categories) {
        catMap[c] = (catMap[c] || 0) + 1;
      }
    }
    const categoryStats = Object.entries(catMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    // Tag distribution
    const tagMap = {};
    for (const b of allBookmarks) {
      for (const t of (b.tags || [])) {
        tagMap[t] = (tagMap[t] || 0) + 1;
      }
    }
    const tagStats = Object.entries(tagMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    // Timeline (bookmarks per day, last 30 days)
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 86400000;
    const dayMap = {};
    for (const b of allBookmarks) {
      const ts = new Date(b.bookmarkedAt || b.createdAt).getTime();
      if (ts >= thirtyDaysAgo) {
        const day = new Date(ts).toISOString().split('T')[0];
        dayMap[day] = (dayMap[day] || 0) + 1;
      }
    }
    const timeline = Object.entries(dayMap).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

    // Media stats
    const withMedia = allBookmarks.filter(b => b.mediaUrls?.length > 0).length;
    const withVideo = allBookmarks.filter(b => b.videoUrls?.length > 0).length;
    const withNotes = allBookmarks.filter(b => b.noteText).length;

    return {
      total,
      uncategorized,
      withMedia,
      withVideo,
      withNotes,
      topAuthors,
      categories: categoryStats,
      tags: tagStats,
      timeline,
    };
  }

  // --- Duplicate Detection ---

  async findDuplicates() {
    const allBookmarks = await this.bookmarks.toArray();
    const tweetIdMap = {};
    const textMap = {};
    const duplicates = [];

    for (const b of allBookmarks) {
      // Exact tweetId duplicates
      if (tweetIdMap[b.tweetId]) {
        duplicates.push({ type: 'exact', original: tweetIdMap[b.tweetId], duplicate: b });
      } else {
        tweetIdMap[b.tweetId] = b;
      }

      // Similar text duplicates (same text, different tweet IDs)
      if (b.text && b.text.length > 20) {
        const textKey = b.text.toLowerCase().trim().replace(/\s+/g, ' ').substring(0, 100);
        if (textMap[textKey] && textMap[textKey].tweetId !== b.tweetId) {
          duplicates.push({ type: 'similar', original: textMap[textKey], duplicate: b });
        } else {
          textMap[textKey] = b;
        }
      }
    }
    return duplicates;
  }

  async mergeDuplicates(keepId, removeId) {
    const keep = await this.bookmarks.get(keepId);
    const remove = await this.bookmarks.get(removeId);
    if (!keep || !remove) return;

    // Merge categories and tags
    const mergedCategories = [...new Set([...(keep.categories || []), ...(remove.categories || [])])];
    const mergedTags = [...new Set([...(keep.tags || []), ...(remove.tags || [])])];
    const mergedNotes = [keep.notes, remove.notes].filter(Boolean).join('\n');

    await this.bookmarks.update(keepId, { categories: mergedCategories, tags: mergedTags, notes: mergedNotes });
    await this.bookmarks.delete(removeId);

    // Remove from collections
    const collections = await this.collections.toArray();
    for (const col of collections) {
      if (col.bookmarkIds?.includes(removeId)) {
        const ids = col.bookmarkIds.filter(id => id !== removeId);
        if (!ids.includes(keepId)) ids.push(keepId);
        await this.collections.update(col.id, { bookmarkIds: ids });
      }
    }
  }

  // --- Offline Reading / Media Cache ---

  async cacheMedia(url) {
    const existing = await this.cachedMedia.get(url);
    if (existing) return existing;
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      const record = { url, blob, type: blob.type, size: blob.size, cachedAt: new Date().toISOString() };
      await this.cachedMedia.put(record);
      return record;
    } catch (e) {
      console.warn('[XBS] Failed to cache media:', url, e.message);
      return null;
    }
  }

  async getCachedMedia(url) {
    const record = await this.cachedMedia.get(url);
    if (!record?.blob) return null;
    return URL.createObjectURL(record.blob);
  }

  async cacheBookmarkMedia(bookmarkId) {
    const bookmark = await this.bookmarks.get(bookmarkId);
    if (!bookmark) return { cached: 0 };
    let cached = 0;
    const urls = [...(bookmark.mediaUrls || []), bookmark.authorAvatarUrl].filter(Boolean);
    for (const url of urls) {
      const result = await this.cacheMedia(url);
      if (result) cached++;
    }
    await this.bookmarks.update(bookmarkId, { offlineCached: true });
    return { cached };
  }

  async cacheAllMedia(onProgress) {
    const allBookmarks = await this.bookmarks.toArray();
    let total = 0;
    let done = 0;
    for (const b of allBookmarks) {
      const urls = [...(b.mediaUrls || []), b.authorAvatarUrl].filter(Boolean);
      total += urls.length;
    }
    for (const b of allBookmarks) {
      const urls = [...(b.mediaUrls || []), b.authorAvatarUrl].filter(Boolean);
      for (const url of urls) {
        await this.cacheMedia(url);
        done++;
        if (onProgress) onProgress(done, total);
      }
      await this.bookmarks.update(b.id, { offlineCached: true });
    }
    return { total: done };
  }

  async getCacheSize() {
    const all = await this.cachedMedia.toArray();
    const totalSize = all.reduce((sum, r) => sum + (r.size || 0), 0);
    return { count: all.length, totalSize, totalSizeMB: (totalSize / 1048576).toFixed(1) };
  }

  async clearCache() {
    await this.cachedMedia.clear();
    // Reset offlineCached flags
    const all = await this.bookmarks.toArray();
    for (const b of all) {
      if (b.offlineCached) await this.bookmarks.update(b.id, { offlineCached: false });
    }
  }

  async clearAll() {
    await this.bookmarks.clear();
    await this.categories.clear();
    await this.tags.clear();
    await this.collections.clear();
    await this.cachedMedia.clear();
    await this.syncState.clear();
  }
}

// Lazy-init singleton
let _db = null;
let _initPromise = null;

async function initDB() {
  // Always delete old DB to avoid schema conflicts during development
  try {
    const testDb = new BookmarkDB();
    await testDb.open();
    return testDb;
  } catch (e) {
    if (e.name === 'UpgradeError' || e.name === 'VersionError') {
      console.warn('[XBS] DB schema incompatible, deleting old database...');
      await Dexie.delete(DB_NAME);
      const freshDb = new BookmarkDB();
      await freshDb.open();
      return freshDb;
    }
    throw e;
  }
}

export async function getDB() {
  if (_db) return _db;
  if (!_initPromise) _initPromise = initDB();
  _db = await _initPromise;
  return _db;
}

// --- Mock Data for Testing ---

export function generateMockBookmarks(count = 10) {
  const authors = [
    { name: 'Elon Musk', handle: 'elonmusk' },
    { name: 'Sam Altman', handle: 'sama' },
    { name: 'Linus Torvalds', handle: 'Linus__Torvalds' },
    { name: 'Dan Abramov', handle: 'dan_abramov2' },
    { name: 'Evan You', handle: 'youyuxi' },
  ];

  const texts = [
    'Just shipped a major update! Performance improvements across the board.',
    'The future of AI is not about replacing humans, but augmenting human capabilities.',
    'Hot take: most "best practices" are just patterns that worked in one specific context.',
    'Thread on system design: Let me explain how we handle 1M requests/sec...',
    'Open source is not just about code. It is about community, trust, and shared ownership.',
    'New blog post: Why I think TypeScript is the best investment for large codebases.',
    'Unpopular opinion: premature optimization is NOT the root of all evil. Premature ABSTRACTION is.',
    'Just released v2.0! Breaking changes listed in the migration guide.',
    'The best code is code you never have to debug. Write it clearly the first time.',
    'Working on something exciting. Stay tuned for the announcement next week!',
  ];

  const bookmarks = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const author = authors[i % authors.length];
    const tweetId = `${1700000000000000000n + BigInt(i * 1000)}`;
    const createdAt = new Date(now - (count - i) * 3600000).toISOString();
    const bookmarkedAt = new Date(now - (count - i) * 1800000).toISOString();

    bookmarks.push({
      tweetId,
      text: texts[i % texts.length],
      authorName: author.name,
      authorHandle: author.handle,
      tweetUrl: `https://x.com/${author.handle}/status/${tweetId}`,
      mediaUrls: i % 3 === 0 ? [`https://pbs.twimg.com/media/example${i}.jpg`] : [],
      createdAt,
      bookmarkedAt,
      categories: [],
      notes: '',
      isRead: false,
      likeCount: Math.floor(Math.random() * 10000),
      retweetCount: Math.floor(Math.random() * 3000),
      replyCount: Math.floor(Math.random() * 500),
    });
  }

  return bookmarks;
}

export async function loadMockData(count = 10) {
  const db = await getDB();
  const mockBookmarks = generateMockBookmarks(count);
  console.log('[XBS] Loading mock data:', mockBookmarks);
  await db.upsertBookmarks(mockBookmarks);

  // Add some test categories
  const existingCats = await db.getAllCategories();
  if (existingCats.length === 0) {
    await db.addCategory('Tech');
    await db.addCategory('AI');
    await db.addCategory('Open Source');
  }

  // Assign categories to some bookmarks
  const allBookmarks = await db.bookmarks.toArray();
  if (allBookmarks.length >= 3) {
    await db.addCategoryToBookmark(allBookmarks[0].id, 'Tech');
    await db.addCategoryToBookmark(allBookmarks[1].id, 'AI');
    await db.addCategoryToBookmark(allBookmarks[2].id, 'Open Source');
    await db.addCategoryToBookmark(allBookmarks[2].id, 'Tech');
  }

  // Set sync state
  await db.setSyncState('lastSyncTime', new Date().toISOString());
  await db.setSyncState('lastSyncNewCount', count);
  await db.setSyncState('totalBookmarks', await db.getBookmarkCount());

  console.log('[XBS] Mock data loaded. Total bookmarks:', await db.getBookmarkCount());
  return { count: await db.getBookmarkCount() };
}

export async function runDBTests() {
  const db = await getDB();
  const results = [];

  try {
    // Test 1: Clear all
    await db.clearAll();
    results.push({ test: 'clearAll', pass: true });

    // Test 2: setSyncState / getSyncState
    await db.setSyncState('testKey', 'testValue');
    const val = await db.getSyncState('testKey');
    results.push({ test: 'syncState put/get', pass: val === 'testValue' });

    // Test 3: Add bookmark
    const id = await db.upsertBookmark({
      tweetId: '12345',
      text: 'Test tweet',
      authorName: 'Test User',
      authorHandle: 'testuser',
      tweetUrl: 'https://x.com/testuser/status/12345',
      mediaUrls: [],
      createdAt: new Date().toISOString(),
      bookmarkedAt: new Date().toISOString(),
      categories: [],
      notes: '',
      isRead: false,
      likeCount: 10,
      retweetCount: 5,
      replyCount: 2,
    });
    results.push({ test: 'upsertBookmark (add)', pass: id > 0 });

    // Test 4: Get count
    const count = await db.getBookmarkCount();
    results.push({ test: 'getBookmarkCount', pass: count === 1 });

    // Test 5: Upsert (update existing)
    const id2 = await db.upsertBookmark({
      tweetId: '12345',
      text: 'Updated text',
      authorName: 'Test User',
      authorHandle: 'testuser',
      tweetUrl: 'https://x.com/testuser/status/12345',
      mediaUrls: [],
      createdAt: new Date().toISOString(),
      bookmarkedAt: new Date().toISOString(),
      categories: ['NewCat'],
      notes: '',
      isRead: false,
      likeCount: 20,
      retweetCount: 10,
      replyCount: 5,
    });
    const countAfterUpsert = await db.getBookmarkCount();
    results.push({ test: 'upsertBookmark (update, no dup)', pass: countAfterUpsert === 1 });

    // Test 6: Category operations
    await db.addCategory('TestCat');
    const cats = await db.getAllCategories();
    results.push({ test: 'addCategory', pass: cats.some(c => c.name === 'TestCat') });

    // Test 7: Add category to bookmark
    await db.addCategoryToBookmark(id, 'TestCat');
    const bm = await db.bookmarks.get(id);
    results.push({ test: 'addCategoryToBookmark', pass: bm.categories.includes('TestCat') });

    // Test 8: Remove category from bookmark
    await db.removeCategoryFromBookmark(id, 'TestCat');
    const bm2 = await db.bookmarks.get(id);
    results.push({ test: 'removeCategoryFromBookmark', pass: !bm2.categories.includes('TestCat') });

    // Test 9: getBookmarks with search
    const { results: searchResults } = await db.getBookmarks({ search: 'Updated' });
    results.push({ test: 'getBookmarks search', pass: searchResults.length === 1 });

    // Test 10: Export JSON
    const json = await db.exportAsJSON();
    results.push({ test: 'exportAsJSON', pass: json.length === 1 && json[0].tweetId === '12345' });

    // Test 11: Export CSV
    const csv = await db.exportAsCSV();
    results.push({ test: 'exportAsCSV', pass: csv.includes('12345') });

    // Test 12: Export Markdown
    const md = await db.exportAsMarkdown();
    results.push({ test: 'exportAsMarkdown', pass: md.includes('@testuser') });

    // Test 13: Delete bookmark
    await db.deleteBookmark(id);
    const countAfterDelete = await db.getBookmarkCount();
    results.push({ test: 'deleteBookmark', pass: countAfterDelete === 0 });

    // Test 14: Bulk upsert
    const bulkData = generateMockBookmarks(5);
    await db.upsertBookmarks(bulkData);
    const countAfterBulk = await db.getBookmarkCount();
    results.push({ test: 'upsertBookmarks (bulk 5)', pass: countAfterBulk === 5 });

    // Test 15: Delete category (cascades to bookmarks)
    await db.addCategory('BulkCat');
    const allBms = await db.bookmarks.toArray();
    await db.addCategoryToBookmark(allBms[0].id, 'BulkCat');
    await db.deleteCategory('BulkCat');
    const bm3 = await db.bookmarks.get(allBms[0].id);
    results.push({ test: 'deleteCategory (cascade)', pass: !bm3.categories.includes('BulkCat') });

    // Clean up
    await db.clearAll();
    results.push({ test: 'final clearAll', pass: true });

  } catch (e) {
    results.push({ test: 'EXCEPTION', pass: false, error: e.message });
  }

  const passed = results.filter(r => r.pass).length;
  const total = results.length;
  console.log(`[XBS] DB Tests: ${passed}/${total} passed`);
  console.table(results);
  return { passed, total, results };
}

// Default export for backward compatibility (auto-opens on import)
const db = new BookmarkDB();
export default db;

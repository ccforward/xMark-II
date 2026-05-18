// background.js - Service worker for X Bookmark Sync
// Strategy:
// 1. Use chrome.webRequest to capture headers from the page's real Bookmarks API calls
// 2. Use chrome.scripting.executeScript to make paginated fetch from page context with captured headers

import { getDB } from './db.js';
import { AIProcessor } from './ai/aiProcessor.js';

// ============================================
// API parameter capture via webRequest
// ============================================

// Store captured API request details (URL + headers) from the browser's Network layer
let capturedApiInfo = null;

// Listen for X API calls at the network level — capture headers from any bookmark-related call
chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    if (details.url.includes('/i/api/graphql/') && details.url.includes('Bookmark')) {
      const headers = {};
      for (const h of details.requestHeaders || []) {
        headers[h.name.toLowerCase()] = h.value;
      }
      capturedApiInfo = {
        url: details.url,
        headers,
        capturedAt: Date.now(),
      };
      chrome.storage.local.set({ apiParams: capturedApiInfo });
    }
  },
  { urls: ['https://x.com/i/api/graphql/*'] },
  ['requestHeaders', 'extraHeaders']
);

async function getApiParams() {
  // Prefer in-memory (most fresh), fall back to storage
  if (capturedApiInfo && Date.now() - capturedApiInfo.capturedAt < 3600000) {
    return capturedApiInfo;
  }
  const stored = await chrome.storage.local.get(['apiParams']);
  if (stored.apiParams) {
    capturedApiInfo = stored.apiParams;
    return capturedApiInfo;
  }
  return null;
}

// ============================================
// Tab management
// ============================================

async function findXTab() {
  const tabs = await chrome.tabs.query({ url: 'https://x.com/*' });
  return tabs.length > 0 ? tabs[0] : null;
}

function waitForTabComplete(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Timeout waiting for page to load'));
    }, 30000);
    const listener = (id, changeInfo) => {
      if (id === tabId && changeInfo.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// Ensure we have a x.com tab to execute fetch from
async function ensureXTab() {
  let tab = await findXTab();
  let autoCreated = false;

  if (!tab) {
    tab = await chrome.tabs.create({ url: 'https://x.com/i/bookmarks', active: false });
    autoCreated = true;
    await waitForTabComplete(tab.id);
    // Wait for page to settle and make its Bookmarks API call (captured by webRequest)
    await new Promise(r => setTimeout(r, 6000));
  }

  return { tab, autoCreated };
}

// Navigate tab to bookmarks to trigger a fresh API call (captured by webRequest)
async function triggerBookmarksApiCall(tab) {
  const tabDetails = await chrome.tabs.get(tab.id);
  if (tabDetails.url?.includes('/i/bookmarks')) {
    // Already on bookmarks page - reload
    await chrome.tabs.reload(tab.id);
  } else {
    await chrome.tabs.update(tab.id, { url: 'https://x.com/i/bookmarks' });
  }
  await waitForTabComplete(tab.id);
  // Wait for the page to make its Bookmarks API call
  await new Promise(r => setTimeout(r, 6000));
}

// Wait for API params to appear (captured by webRequest listener)
async function waitForApiParams(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const params = await getApiParams();
    if (params?.url && params?.headers) return params;
    await new Promise(r => setTimeout(r, 1000));
  }
  return null;
}

// ============================================
// Bookmark API fetching
// ============================================

// Ensure content scripts are injected and responsive in the given tab
async function ensureContentScript(tabId) {
  try {
    const resp = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    if (resp?.ok) return;
  } catch {}

  // Content script not responding — reload the tab to trigger re-injection
  // (manifest.json already declares the content scripts, no need to inject manually)
  try {
    await chrome.tabs.reload(tabId);
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1000));
      try {
        const resp = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
        if (resp?.ok) return;
      } catch {}
    }
    throw new Error('Content script did not respond after reload');
  } catch (e) {
    throw new Error('Content script not responding. Try opening x.com in a new tab and syncing again.');
  }
}

let fetchRequestCounter = 0;

async function fetchBookmarksPage(tabId, cursor = null) {
  // Ensure content script is ready before sending messages
  await ensureContentScript(tabId);

  const apiParams = await getApiParams();
  if (!apiParams?.url || !apiParams?.headers) {
    throw new Error('No API parameters available.');
  }

  // Build URL: reuse captured queryId + features, modify cursor
  const urlObj = new URL(apiParams.url);
  const variables = JSON.parse(urlObj.searchParams.get('variables') || '{}');
  variables.count = 100;
  if (cursor) {
    variables.cursor = cursor;
  } else {
    delete variables.cursor;
  }
  urlObj.searchParams.set('variables', JSON.stringify(variables));
  const url = urlObj.toString();

  // Build headers from captured data (skip browser-managed headers)
  const headers = {};
  for (const [key, value] of Object.entries(apiParams.headers)) {
    const lk = key.toLowerCase();
    if (['cookie', 'host', 'connection', 'content-length', 'accept-encoding',
         'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest',
         'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
         'referer', 'origin'].includes(lk)) continue;
    headers[key] = value;
  }

  const requestId = `xbs_${++fetchRequestCounter}_${Date.now()}`;

  // Send fetch request to content.js which relays to MAIN world
  const data = await new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, {
      type: 'XBS_FETCH_IN_PAGE',
      requestId,
      url,
      headers,
    }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(`Content script error: ${chrome.runtime.lastError.message}. Try reloading the x.com tab.`));
        return;
      }
      if (!response) {
        reject(new Error('No response from content script. Reload x.com tab and retry.'));
        return;
      }
      resolve(response);
    });
  });

  if (data.error) {
    if (data.status === 401 || data.status === 403) {
      capturedApiInfo = null;
      await chrome.storage.local.remove('apiParams');
      const detail = data.body ? `\n${data.body.substring(0, 150)}` : '';
      throw new Error(`Auth failed (${data.status}). Params cleared. Reload x.com/i/bookmarks and retry.${detail}`);
    }
    if (data.status === 404) {
      capturedApiInfo = null;
      await chrome.storage.local.remove('apiParams');
      throw new Error('API 404. Params cleared. Reload x.com/i/bookmarks and retry.');
    }
    // Log detailed error for debugging 422 and other errors
    if (data.status === 422) {
      console.error('[XBS] 422 Error - URL:', url.substring(0, 200));
      console.error('[XBS] 422 Error - Body:', data.body);
      try {
        console.error('[XBS] 422 Error - Variables:', JSON.parse(new URL(url).searchParams.get('variables') || '{}'));
      } catch {}
      // Clear stale params
      capturedApiInfo = null;
      await chrome.storage.local.remove('apiParams');
      // Signal that sync should auto-recover by reloading bookmarks page
      throw new Error('XBS_422_RECOVERABLE');
    }
    const detail = data.body ? ` - ${data.body.substring(0, 200)}` : '';
    throw new Error(`API error: ${data.status || ''} ${data.statusText || data.message || ''}${detail}`);
  }

  return data.data;
}

// ============================================
// Response parsing
// ============================================

let _loggedQuotedTweet = false;
let _loggedTweetData = false;
let _loggedBookmarkResponse = false;

function parseTweetData(tweetResult) {
  if (!tweetResult) return null;

  // Unwrap TweetWithVisibilityResults
  if (tweetResult.__typename === 'TweetWithVisibilityResults' && tweetResult.tweet) {
    tweetResult = tweetResult.tweet;
  }

  // Unwrap tweet_results.result if present
  if (tweetResult.tweet_results?.result) {
    tweetResult = tweetResult.tweet_results.result;
  }

  const tweet = tweetResult.legacy || tweetResult;

  // Extract user info from core.user_results.result
  const userResult = tweetResult.core?.user_results?.result;
  const screenName = userResult?.core?.screen_name || userResult?.legacy?.screen_name || '';
  const authorName = userResult?.core?.name || userResult?.legacy?.name || '';
  const authorAvatarUrl = userResult?.avatar?.image_url || userResult?.legacy?.profile_image_url_https || '';

  // Text: handle Note tweets (long-form articles)
  let text = tweet.full_text || '';
  let noteText = null;

  // Note tweet / long-form article
  const noteTweet = tweetResult.note_tweet?.note_tweet_results?.result;

  // Debug: log first tweet's raw data to inspect sync JSON format
  if (!_loggedTweetData) {
    _loggedTweetData = true;
    console.log('[XBS] Raw tweetResult sample:', JSON.stringify(tweetResult, null, 2));
    console.log('[XBS] tweet.full_text:', text);
    console.log('[XBS] tweet.entities?.urls:', JSON.stringify(tweet.entities?.urls));
    console.log('[XBS] noteTweet:', JSON.stringify(noteTweet));
  }
  if (noteTweet) {
    noteText = noteTweet.text || '';
    // Note tweets have richer entities
    if (noteTweet.entity_set?.urls) {
      for (const u of noteTweet.entity_set.urls) {
        if (u.expanded_url) {
          noteText = noteText.replace(u.url, u.expanded_url);
        }
      }
    }
  }

  // Retweet handling
  if (tweet.retweeted_status_result?.result) {
    const rt = parseTweetData(tweet.retweeted_status_result.result);
    if (rt) text = `RT @${rt.authorHandle}: ${rt.text}`;
  }

  // Media extraction
  const mediaUrls = [];
  const mediaTypes = [];
  const videoThumbnails = [];
  const videoUrls = [];

  const allMedia = [
    ...(tweet.extended_entities?.media || []),
    ...(tweet.entities?.media || []),
  ];
  const seen = new Set();

  for (const m of allMedia) {
    const url = m.media_url_https || m.media_url;
    if (!url || seen.has(url)) continue;
    seen.add(url);

    mediaUrls.push(url);
    mediaTypes.push(m.type || 'photo');

    if (m.type === 'video' || m.type === 'animated_gif') {
      // Get video thumbnail
      videoThumbnails.push(url);
      // Get best quality video URL
      const variants = m.video_info?.variants || [];
      const mp4s = variants
        .filter(v => v.content_type === 'video/mp4')
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      if (mp4s.length > 0) {
        videoUrls.push(mp4s[0].url);
      }
    }
  }

  const tweetId = tweetResult.rest_id || tweet.id_str || tweet.id;
  if (!tweetId) return null;

  const tweetUrl = `https://x.com/${screenName}/status/${tweetId}`;

  // X API auto-appends a t.co link in full_text for media (photos/videos).
  // These are in entities.media[].url — remove only these from the text.
  // All other links (external URLs in entities.urls) are kept as-is.
  const mediaShortUrls = new Set(
    (tweet.entities?.media || []).map(m => m.url).filter(Boolean)
  );
  let cleanText = text || '';
  for (const mediaUrl of mediaShortUrls) {
    const escaped = mediaUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleanText = cleanText.replace(new RegExp('\\s*' + escaped, 'g'), '');
  }
  cleanText = cleanText.trim();

  // External URLs list (expanded, excluding media t.co links)
  const externalUrls = (tweet.entities?.urls || [])
    .filter(u => !mediaShortUrls.has(u.url))

  const urls = externalUrls.map(u => u.expanded_url || u.url)

  return {
    tweetId: String(tweetId),
    text: cleanText,
    fullText: text,
    noteText,
    authorName,
    authorHandle: screenName,
    authorAvatarUrl: authorAvatarUrl.replace('_normal.', '_bigger.').replace('_normal', '_bigger'),
    tweetUrl: `https://x.com/${screenName}/status/${tweetId}`,
    mediaUrls,
    mediaTypes,
    videoUrls,
    videoThumbnails,
    urls,
    createdAt: (() => { try { return tweet.created_at ? new Date(tweet.created_at).toISOString() : null; } catch { return null; } })(),
    likeCount: tweet.favorite_count || 0,
    retweetCount: tweet.retweet_count || 0,
    replyCount: tweet.reply_count || 0,
    bookmarkCount: tweet.bookmark_count || 0,
    viewCount: parseInt(tweetResult.views?.count) || parseInt(tweet.ext_views?.count) || null,
    language: tweet.lang || null,
    isRetweet: !!(tweet.retweeted_status_result?.result),
    isNote: !!noteTweet,
    quotedTweetId: tweet.quoted_status_id_str || null,
    quotedTweet: (() => {
      const qtResult = tweetResult.quoted_status_result?.result;
      if (!qtResult) return null;
      const qt = parseTweetData(qtResult);
      if (!qt) return null;
      return {
        tweetId: qt.tweetId,
        text: qt.text,
        authorName: qt.authorName,
        authorHandle: qt.authorHandle,
        authorAvatarUrl: qt.authorAvatarUrl,
        tweetUrl: qt.tweetUrl,
        mediaUrls: qt.mediaUrls,
        mediaTypes: qt.mediaTypes,
        videoUrls: qt.videoUrls,
        createdAt: qt.createdAt,
      };
    })(),
    article: (() => {
      const articleResult = tweetResult.article?.article_results?.result;
      if (!articleResult) return null;
      const coverMedia = articleResult.cover_media?.media_info;
      const articleUrl = tweetResult.card?.rest_id || null;
      return {
        id: articleResult.rest_id || null,
        title: articleResult.title || null,
        previewText: articleResult.preview_text || null,
        coverImageUrl: coverMedia?.original_img_url || null,
        coverImageWidth: coverMedia?.original_img_width || null,
        coverImageHeight: coverMedia?.original_img_height || null,
        articleUrl,
        publishedAt: articleResult.metadata?.first_published_at_secs
          ? new Date(articleResult.metadata.first_published_at_secs * 1000).toISOString()
          : null,
      };
    })(),
  };
}

function parseBookmarksResponse(data) {
  const bookmarks = [];
  let cursorTop = null;
  let cursorBottom = null;

  try {
    // Try multiple known response paths
    const instructions =
      data?.data?.bookmark_timeline_v2?.timeline?.instructions ||
      data?.data?.bookmarks_timeline?.timeline?.instructions ||
      data?.data?.viewer?.bookmarks_timeline?.timeline?.instructions ||
      data?.data?.bookmark_timeline?.timeline?.instructions ||
      [];

    if (instructions.length === 0) {
      console.warn('[XBS] No instructions found in response. Keys:', JSON.stringify(Object.keys(data?.data || {})));
    }

    // Debug: log raw first entry structure once per session
    if (!_loggedBookmarkResponse) {
      _loggedBookmarkResponse = true;
      const firstEntry = instructions[0]?.entries?.find(e => !e.entryId?.startsWith('cursor-'));
      if (firstEntry) {
        console.log('[XBS] Raw first bookmark entry:', JSON.stringify(firstEntry, null, 2));
      }
    }

    for (const instruction of instructions) {
      const entries = instruction.entries || [];
      if (instruction.type === 'TimelineAddEntries' || entries.length > 0) {
        for (const entry of entries) {
          try {
            // Cursor entries
            if (entry.content?.entryType === 'TimelineTimelineCursor' ||
                entry.content?.__typename === 'TimelineTimelineCursor') {
              if (entry.content.cursorType === 'Top') cursorTop = entry.content.value;
              else if (entry.content.cursorType === 'Bottom') cursorBottom = entry.content.value;
              continue;
            }

            // Also check cursor in entry id pattern
            if (entry.entryId?.startsWith('cursor-bottom-')) {
              cursorBottom = entry.content?.value || entry.content?.itemContent?.value;
              continue;
            }
            if (entry.entryId?.startsWith('cursor-top-')) {
              cursorTop = entry.content?.value || entry.content?.itemContent?.value;
              continue;
            }

            // Single tweet entry
            if (entry.content?.itemContent) {
              const ic = entry.content.itemContent;
              const tr = ic.tweet_results?.result || ic.tweet_with_visibility_results?.result || ic.tweet_with_visibility_results || ic.tweet;
              if (tr) {
                const parsed = parseTweetData(tr);
                if (parsed) {
                  bookmarks.push(parsed);
                }
              }
            }

            // Module with items (TimelineTimelineModule)
            if (entry.content?.items) {
              for (const item of entry.content.items) {
                try {
                  const ic = item.item?.itemContent;
                  const tr = ic?.tweet_results?.result || ic?.tweet_with_visibility_results?.result || ic?.tweet_with_visibility_results || ic?.tweet;
                  if (tr) {
                    const parsed = parseTweetData(tr);
                    if (parsed) {
                      bookmarks.push(parsed);
                    }
                  }
                } catch (itemErr) {
                  console.warn('[XBS] Error parsing item:', itemErr);
                }
              }
            }
          } catch (entryErr) {
            console.warn('[XBS] Error parsing entry:', entryErr);
          }
        }
      }
    }
  } catch (e) {
    console.error('[XBS] Error parsing bookmarks:', e);
  }

  console.log(`[XBS] parseBookmarksResponse result: ${bookmarks.length} bookmarks, cursorBottom: ${cursorBottom ? 'yes' : 'no'}`);
  return { bookmarks, cursorTop, cursorBottom };
}

// ============================================
// Sync logic
// ============================================

let syncInProgress = false;

async function syncBookmarks({ fullSync = false } = {}) {
  if (syncInProgress) return { status: 'already_syncing' };
  syncInProgress = true;
  let tabInfo = null;

  try {
    broadcastStatus({ state: 'syncing', message: 'Preparing...' });

    // Step 1: Ensure we have a x.com tab
    tabInfo = await ensureXTab();
    const tab = tabInfo.tab;

    // Step 2: Check if we have captured API params
    let apiParams = await getApiParams();

    if (!apiParams?.url || !apiParams?.headers) {
      // No params yet - trigger a bookmarks page load to capture them via webRequest
      broadcastStatus({ state: 'syncing', message: 'Navigating to bookmarks to capture auth...' });
      await triggerBookmarksApiCall(tab);
      apiParams = await waitForApiParams(20000);

      if (!apiParams?.url || !apiParams?.headers) {
        throw new Error(
          'Could not capture API parameters. Please:\n' +
          '1. Make sure you are logged in to x.com\n' +
          '2. Open x.com/i/bookmarks manually\n' +
          '3. Wait for bookmarks to load\n' +
          '4. Then click Sync again'
        );
      }
    }

    broadcastStatus({ state: 'syncing', message: 'Starting fetch...' });

    const db = await getDB();
    let allBookmarks = [];
    let cursor = null;
    let page = 0;
    let newCount = 0;
    const existingTweetIds = new Set((await db.bookmarks.toArray()).map(b => b.tweetId));
    let shouldStop = false;
    const syncStartTime = new Date().toISOString();

    // Backfill bookmarkedAt for existing records that lack it
    try {
      const missingBookmarkedAt = await db.bookmarks.filter(b => !b.bookmarkedAt).toArray();
      if (missingBookmarkedAt.length > 0) {
        console.log(`[XBS] Backfilling bookmarkedAt for ${missingBookmarkedAt.length} records...`);
        for (const b of missingBookmarkedAt) {
          await db.bookmarks.update(b.id, { bookmarkedAt: b.createdAt || syncStartTime });
        }
      }
    } catch (e) {
      console.warn('[XBS] Failed to backfill bookmarkedAt:', e.message);
    }

    while (!shouldStop) {
      page++;
      broadcastStatus({ state: 'syncing', message: `Page ${page}... (${newCount} new)`, page, newCount });

      let data;
      try {
        data = await fetchBookmarksPage(tab.id, cursor);
      } catch (e) {
        // Auto-recover from 422 by reloading bookmarks page to get fresh params
        if (e.message === 'XBS_422_RECOVERABLE') {
          console.log('[XBS] 422 detected, auto-recovering by reloading bookmarks page...');
          broadcastStatus({ state: 'syncing', message: 'Refreshing auth params...' });
          await triggerBookmarksApiCall(tab);
          const freshParams = await waitForApiParams(20000);
          if (!freshParams?.url || !freshParams?.headers) {
            throw new Error('Could not capture fresh API params. Please reload x.com/i/bookmarks manually and retry.');
          }
          broadcastStatus({ state: 'syncing', message: `Retrying page ${page}...` });
          data = await fetchBookmarksPage(tab.id, cursor);
        } else {
          broadcastStatus({ state: 'error', message: e.message });
          throw e;
        }
      }

      const { bookmarks, cursorBottom } = parseBookmarksResponse(data);
      console.log(`[XBS] Page ${page}: ${bookmarks.length} bookmarks, cursor: ${cursorBottom ? 'yes' : 'no'}`);

      // Log first quoted tweet structure for debugging
      if (!_loggedQuotedTweet) {
        const raw = data?.data;
        const instructions = raw?.bookmark_timeline_v2?.timeline?.instructions ||
          raw?.bookmarks_timeline?.timeline?.instructions ||
          raw?.viewer?.bookmarks_timeline?.timeline?.instructions || [];
        for (const inst of instructions) {
          for (const entry of inst.entries || []) {
            const ic = entry.content?.itemContent;
            const tr = ic?.tweet_results?.result || ic?.tweet_with_visibility_results?.result || ic?.tweet_with_visibility_results;
            let tweet = tr;
            if (tweet?.__typename === 'TweetWithVisibilityResults') tweet = tweet.tweet;
            const legacy = tweet?.legacy;
            if (legacy?.quoted_status_result || tweet?.quoted_status_result) {
              console.log('[XBS] Found quoted tweet entry:', JSON.parse(JSON.stringify(tweet)));
              _loggedQuotedTweet = true;
              break;
            }
          }
          if (_loggedQuotedTweet) break;
        }
      }

      if (bookmarks.length === 0) { shouldStop = true; break; }

      // Calculate bookmarkedAt for new bookmarks in this page
      // X returns bookmarks newest-first, so the first one should have the latest timestamp
      // Use a staggered approach: each new bookmark gets a slightly earlier timestamp
      // This ensures proper sorting: newest synced bookmarks appear at the top
      let syncIndex = 0;
      for (const bm of bookmarks) {
        if (!fullSync && existingTweetIds.has(bm.tweetId)) { shouldStop = true; break; }
        if (!existingTweetIds.has(bm.tweetId)) {
          // Subtract syncIndex seconds from now, so first bookmark has the latest time
          const bmTime = new Date(Date.now() - syncIndex * 1000).toISOString();
          bm.bookmarkedAt = bmTime;
          allBookmarks.push(bm);
          existingTweetIds.add(bm.tweetId);
          newCount++;
          syncIndex++;
        }
      }

      if (!shouldStop && cursorBottom) {
        cursor = cursorBottom;
        await new Promise(r => setTimeout(r, 2000));
      } else {
        shouldStop = true;
      }
      if (page >= 50) shouldStop = true;
    }

    if (allBookmarks.length > 0) await db.upsertBookmarks(allBookmarks);

    await db.setSyncState('lastSyncTime', new Date().toISOString());
    await db.setSyncState('lastSyncNewCount', newCount);
    await db.setSyncState('totalBookmarks', await db.getBookmarkCount());

    // AI auto-processing after sync
    if (newCount > 0) {
      try {
        const { aiConfig } = await chrome.storage.local.get(['aiConfig']);
        if (aiConfig?.autoProcessAfterSync && aiConfig?.activeModelId) {
          const activeModel = aiConfig.models?.find(m => m.id === aiConfig.activeModelId);
          if (activeModel) {
            broadcastStatus({ state: 'ai_processing', message: `Processing ${newCount} bookmarks with AI...` });
            const processor = new AIProcessor(activeModel, aiConfig);
            await processor.processUnprocessed((progress) => {
              broadcastStatus({ state: 'ai_processing', message: `AI: ${progress.processed}/${progress.total}` });
            });
          }
        }
      } catch (e) {
        console.warn('[XBS] AI processing error:', e.message);
      }
    }

    broadcastStatus({ state: 'completed', message: `Done! ${newCount} new bookmarks.`, newCount, totalBookmarks: await db.getBookmarkCount() });
    return { status: 'completed', newCount, totalBookmarks: await db.getBookmarkCount() };

  } catch (e) {
    broadcastStatus({ state: 'error', message: e.message });
    throw e;
  } finally {
    syncInProgress = false;
    if (tabInfo?.autoCreated && tabInfo?.tab?.id) {
      try { await chrome.tabs.remove(tabInfo.tab.id); } catch {}
    }
  }
}

// ============================================
// Status broadcasting
// ============================================

function broadcastStatus(status) {
  chrome.runtime.sendMessage({ type: 'SYNC_STATUS_UPDATE', ...status }).catch(() => {});
  chrome.storage.local.set({ lastSyncStatus: status });
}

// ============================================
// Context Menu (right-click on x.com)
// ============================================

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'xbs-add-tag',
    title: 'XB Sync: Add tag to this tweet',
    contexts: ['link'],
    documentUrlPatterns: ['https://x.com/*'],
  });
  chrome.contextMenus.create({
    id: 'xbs-add-category',
    title: 'XB Sync: Add category to this tweet',
    contexts: ['link'],
    documentUrlPatterns: ['https://x.com/*'],
  });
  chrome.contextMenus.create({
    id: 'xbs-bookmark-tweet',
    title: 'XB Sync: Save this tweet',
    contexts: ['link'],
    documentUrlPatterns: ['https://x.com/*'],
  });
});

// ============================================
// Action icon click — open dashboard
// ============================================

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const linkUrl = info.linkUrl || '';
  // Extract tweet ID from URL like https://x.com/user/status/123456
  const match = linkUrl.match(/x\.com\/\w+\/status\/(\d+)/);
  if (!match) return;

  const tweetId = match[1];
  const db = await getDB();
  const existing = await db.bookmarks.where('tweetId').equals(tweetId).first();

  if (info.menuItemId === 'xbs-bookmark-tweet') {
    if (existing) {
      // Already saved
      chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon48.png', title: 'XB Sync', message: 'Tweet already saved in bookmarks.' });
    } else {
      chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon48.png', title: 'XB Sync', message: 'Tweet will be synced on next sync.' });
    }
    return;
  }

  if (!existing) {
    chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon48.png', title: 'XB Sync', message: 'Tweet not found in bookmarks. Sync first.' });
    return;
  }

  // Send message to options page to handle tag/category UI
  chrome.runtime.sendMessage({
    type: 'CONTEXT_MENU_ACTION',
    action: info.menuItemId === 'xbs-add-tag' ? 'addTag' : 'addCategory',
    bookmarkId: existing.id,
    tweetId,
  }).catch(() => {});
});

// ============================================
// Enhanced message handling
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'API_PARAMS_CAPTURED') {
    capturedApiInfo = message.data;
    chrome.storage.local.set({ apiParams: message.data }).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'BOOKMARK_DATA_CAPTURED') {
    const { bookmarks } = parseBookmarksResponse(message.data);
    if (bookmarks.length > 0) {
      const now = new Date().toISOString();
      for (const bm of bookmarks) {
        if (!bm.bookmarkedAt) bm.bookmarkedAt = now;
      }
      getDB().then(db => db.upsertBookmarks(bookmarks)).then(() => sendResponse({ ok: true, count: bookmarks.length }));
    } else {
      sendResponse({ ok: true, count: 0 });
    }
    return true;
  }

  if (message.type === 'START_SYNC') {
    syncBookmarks({ fullSync: message.fullSync || false })
      .then(result => sendResponse(result))
      .catch(e => sendResponse({ status: 'error', message: e.message }));
    return true;
  }

  if (message.type === 'GET_SYNC_STATUS') {
    chrome.storage.local.get(['lastSyncStatus'], (result) => {
      sendResponse(result.lastSyncStatus || { state: 'idle', message: 'Ready' });
    });
    return true;
  }

  if (message.type === 'GET_STATS') {
    (async () => {
      const db = await getDB();
      const count = await db.getBookmarkCount();
      const lastSync = await db.getSyncState('lastSyncTime');
      sendResponse({ bookmarkCount: count, lastSyncTime: lastSync });
    })();
    return true;
  }

  if (message.type === 'GET_AI_CONFIG') {
    chrome.storage.local.get(['aiConfig'], (result) => {
      sendResponse(result.aiConfig || null);
    });
    return true;
  }

  if (message.type === 'SET_AI_CONFIG') {
    chrome.storage.local.set({ aiConfig: message.config }).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === 'AI_PROCESS_SINGLE') {
    (async () => {
      try {
        const { aiConfig } = await chrome.storage.local.get(['aiConfig']);
        const activeModel = aiConfig?.models?.find(m => m.id === aiConfig.activeModelId);
        if (!activeModel) { sendResponse({ error: 'No active AI model configured' }); return; }
        const processor = new AIProcessor(activeModel, aiConfig);
        const result = await processor.processSingle(message.bookmarkId);
        sendResponse({ ok: true, bookmark: result });
      } catch (e) {
        sendResponse({ error: e.message });
      }
    })();
    return true;
  }

  if (message.type === 'AI_PROCESS_UNPROCESSED') {
    (async () => {
      try {
        const { aiConfig } = await chrome.storage.local.get(['aiConfig']);
        const activeModel = aiConfig?.models?.find(m => m.id === aiConfig.activeModelId);
        if (!activeModel) { sendResponse({ error: 'No active AI model configured' }); return; }
        const processor = new AIProcessor(activeModel, aiConfig);
        broadcastStatus({ state: 'ai_processing', message: 'Processing bookmarks with AI...' });
        const result = await processor.processUnprocessed((progress) => {
          broadcastStatus({ state: 'ai_processing', message: `AI: ${progress.processed}/${progress.total}` });
        });
        broadcastStatus({ state: 'completed', message: `AI processed ${result.processed} bookmarks.` });
        sendResponse({ ok: true, ...result });
      } catch (e) {
        broadcastStatus({ state: 'error', message: `AI error: ${e.message}` });
        sendResponse({ error: e.message });
      }
    })();
    return true;
  }
});

broadcastStatus({ state: 'idle', message: 'Ready' });
console.log('X Bookmark Sync service worker started.');

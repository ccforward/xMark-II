// background.js - Service worker for X Bookmark Sync
// Strategy:
// 1. Use chrome.webRequest to capture headers from the page's real Bookmarks API calls
// 2. Use chrome.scripting.executeScript to make paginated fetch from page context with captured headers

import { getDB } from './db.js';

// ============================================
// API parameter capture via webRequest
// ============================================

// Store captured API request details (URL + headers) from the browser's Network layer
let capturedApiInfo = null;

// Listen for Bookmarks API calls at the network level — this ALWAYS works
chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    if (details.url.includes('/i/api/graphql/') && details.url.includes('Bookmarks')) {
      const headers = {};
      for (const h of details.requestHeaders || []) {
        headers[h.name.toLowerCase()] = h.value;
      }
      capturedApiInfo = {
        url: details.url,
        headers,
        capturedAt: Date.now(),
      };
      console.log('[XBS] Captured API params via webRequest');
      // Persist to storage
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
  // Try pinging the content script
  try {
    const resp = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    if (resp?.ok) return; // Already alive
  } catch {}

  // Content script not responding — inject both scripts
  console.log('[XBS] Content script not responding, injecting...');
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-inject.js'],
      world: 'MAIN',
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
    // Wait a moment for scripts to initialize
    await new Promise(r => setTimeout(r, 500));
  } catch (e) {
    console.warn('[XBS] Failed to inject content scripts:', e.message);
    throw new Error('Cannot inject content scripts. Make sure the x.com tab is fully loaded.');
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
    throw new Error(`API error: ${data.status || ''} ${data.statusText || data.message || ''}`);
  }

  return data.data;
}

// ============================================
// Response parsing
// ============================================

let _loggedQuotedTweet = false;

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

  // External URLs (excluding media t.co links)
  const mediaShortUrls = new Set((tweet.entities?.media || []).map(m => m.url));
  const urls = (tweet.entities?.urls || [])
    .filter(u => !mediaShortUrls.has(u.url))
    .map(u => u.expanded_url || u.url);

  const tweetId = tweetResult.rest_id || tweet.id_str || tweet.id;
  if (!tweetId) return null;

  // Clean text: remove trailing t.co links
  const cleanText = (text || '').replace(/\s*https:\/\/t\.co\/\w+\s*$/g, '').trim();

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
    createdAt: tweet.created_at ? new Date(tweet.created_at).toISOString() : null,
    likeCount: tweet.favorite_count || 0,
    retweetCount: tweet.retweet_count || 0,
    replyCount: tweet.reply_count || 0,
    bookmarkCount: tweet.bookmark_count || 0,
    viewCount: parseInt(tweetResult.views?.count) || parseInt(tweet.ext_views?.count) || null,
    language: tweet.lang || null,
    isRetweet: !!(tweet.retweeted_status_result?.result),
    isNote: !!noteTweet,
    quotedTweetId: tweet.quoted_status_id_str || null,
    bookmarkedAt: new Date().toISOString(),
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
                  // Try to extract bookmarkedAt from sortIndex (Twitter Snowflake ID)
                  if (entry.sortIndex) {
                    try {
                      const snowflake = BigInt(entry.sortIndex);
                      const ts = Number((snowflake >> 22n) + 1288834974657n);
                      if (ts > 1e12 && ts < 2e12) {
                        parsed.bookmarkedAt = new Date(ts).toISOString();
                      }
                    } catch {}
                  }
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
                      if (item.item?.sortIndex) {
                        try {
                          const snowflake = BigInt(item.item.sortIndex);
                          const ts = Number((snowflake >> 22n) + 1288834974657n);
                          if (ts > 1e12 && ts < 2e12) {
                            parsed.bookmarkedAt = new Date(ts).toISOString();
                          }
                        } catch {}
                      }
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

    while (!shouldStop) {
      page++;
      broadcastStatus({ state: 'syncing', message: `Page ${page}... (${newCount} new)`, page, newCount });

      let data;
      try {
        data = await fetchBookmarksPage(tab.id, cursor);
      } catch (e) {
        broadcastStatus({ state: 'error', message: e.message });
        throw e;
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

      for (const bm of bookmarks) {
        if (!fullSync && existingTweetIds.has(bm.tweetId)) { shouldStop = true; break; }
        if (!existingTweetIds.has(bm.tweetId)) {
          allBookmarks.push(bm);
          existingTweetIds.add(bm.tweetId);
          newCount++;
        }
      }

      if (!shouldStop && cursorBottom) {
        cursor = cursorBottom;
        await new Promise(r => setTimeout(r, 500));
      } else {
        shouldStop = true;
      }
      if (page >= 50) shouldStop = true;
    }

    if (allBookmarks.length > 0) await db.upsertBookmarks(allBookmarks);

    await db.setSyncState('lastSyncTime', new Date().toISOString());
    await db.setSyncState('lastSyncNewCount', newCount);
    await db.setSyncState('totalBookmarks', await db.getBookmarkCount());

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
// Message handling
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'API_PARAMS_CAPTURED') {
    // From content script (backup path)
    capturedApiInfo = message.data;
    chrome.storage.local.set({ apiParams: message.data }).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'BOOKMARK_DATA_CAPTURED') {
    const { bookmarks } = parseBookmarksResponse(message.data);
    if (bookmarks.length > 0) {
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
});

// ============================================
// Periodic sync
// ============================================

chrome.alarms.create('periodicSync', { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'periodicSync') {
    chrome.tabs.query({ url: 'https://x.com/*' }, (tabs) => {
      if (tabs.length > 0) syncBookmarks({ fullSync: false }).catch(console.error);
    });
  }
});

broadcastStatus({ state: 'idle', message: 'Ready' });
console.log('X Bookmark Sync service worker started.');

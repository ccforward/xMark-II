// content.js - Runs in ISOLATED world on x.com
// Relays messages between background script and MAIN world (content-inject.js)

// Track pending fetch requests from background
const pendingRequests = new Map();

// Messages FROM MAIN world (content-inject.js)
window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  if (event.data?.type === 'XBS_API_PARAMS') {
    chrome.runtime.sendMessage({ type: 'API_PARAMS_CAPTURED', data: event.data.data }).catch(() => {});
  }

  if (event.data?.type === 'XBS_BOOKMARK_DATA') {
    chrome.runtime.sendMessage({ type: 'BOOKMARK_DATA_CAPTURED', data: event.data.data }).catch(() => {});
  }

  // Fetch response from MAIN world → send back to background
  if (event.data?.type === 'XBS_FETCH_RESPONSE') {
    const { requestId } = event.data;
    const pending = pendingRequests.get(requestId);
    if (pending) {
      pendingRequests.delete(requestId);
      pending.sendResponse(event.data);
    }
  }
});

// Messages FROM background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_X_LOGGED_IN') {
    const loggedIn = document.cookie.includes('auth_token');
    sendResponse({ loggedIn });
    return false;
  }

  if (message.type === 'PING') {
    sendResponse({ ok: true, url: window.location.href });
    return false;
  }

  // Background wants us to make a fetch in MAIN world
  if (message.type === 'XBS_FETCH_IN_PAGE') {
    const requestId = message.requestId;
    // Store the sendResponse callback
    pendingRequests.set(requestId, { sendResponse });

    // Forward to MAIN world
    window.postMessage({
      type: 'XBS_FETCH_REQUEST',
      requestId,
      url: message.url,
      headers: message.headers,
    }, '*');

    // Timeout after 30s
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        sendResponse({ error: true, message: 'Timeout waiting for fetch response from page' });
      }
    }, 30000);

    return true; // Keep sendResponse alive
  }
});

// Notify background that content script is ready
chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY', url: window.location.href }).catch(() => {});

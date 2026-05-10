// content-inject.js - Runs in MAIN world on x.com
// Handles:
// 1. Passively captures bookmark API params from page's own fetch calls
// 2. Executes fetch requests on behalf of the background script (via message relay)

(function () {
  window.__xbs_capturedRequest = null;

  const originalFetch = window.fetch;

  // Intercept fetch to capture Bookmarks API params
  window.fetch = async function (...args) {
    let url = '';
    let requestHeaders = {};

    try {
      if (args[0] instanceof Request) {
        url = args[0].url;
        args[0].headers.forEach((value, key) => { requestHeaders[key] = value; });
      } else {
        url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
        const opts = args[1] || {};
        if (opts.headers) {
          if (opts.headers instanceof Headers) {
            opts.headers.forEach((value, key) => { requestHeaders[key] = value; });
          } else if (Array.isArray(opts.headers)) {
            for (const [k, v] of opts.headers) requestHeaders[k] = v;
          } else if (typeof opts.headers === 'object') {
            for (const k in opts.headers) {
              if (Object.prototype.hasOwnProperty.call(opts.headers, k)) requestHeaders[k] = opts.headers[k];
            }
          }
        }
      }
    } catch (e) { /* ignore */ }

    const response = await originalFetch.apply(this, args);

    try {
      if (url.includes('/i/api/graphql/') && url.includes('Bookmarks')) {
        window.__xbs_capturedRequest = { url, headers: requestHeaders, capturedAt: Date.now() };
        window.postMessage({ type: 'XBS_API_PARAMS', data: { url, headers: requestHeaders, capturedAt: Date.now() } }, '*');

        // Passively capture the response
        const cloned = response.clone();
        cloned.json().then(data => {
          window.postMessage({ type: 'XBS_BOOKMARK_DATA', data }, '*');
        }).catch(() => {});
      }
    } catch (e) { /* silently fail */ }

    return response;
  };

  // Listen for fetch requests from content.js (ISOLATED world) relayed from background
  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== 'XBS_FETCH_REQUEST') return;

    const { requestId, url, headers } = event.data;
    console.log('[XBS-MAIN] Fetch request received:', url.substring(0, 100));

    try {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: headers || {},
      });

      if (!response.ok) {
        let body = '';
        try { body = await response.text(); } catch {}
        window.postMessage({
          type: 'XBS_FETCH_RESPONSE',
          requestId,
          error: true,
          status: response.status,
          statusText: response.statusText,
          body: body.substring(0, 1000),
        }, '*');
        return;
      }

      const data = await response.json();
      window.postMessage({
        type: 'XBS_FETCH_RESPONSE',
        requestId,
        error: false,
        data,
      }, '*');
    } catch (e) {
      window.postMessage({
        type: 'XBS_FETCH_RESPONSE',
        requestId,
        error: true,
        message: e.message,
      }, '*');
    }
  });

  window.postMessage({ type: 'XBS_MAIN_WORLD_READY' }, '*');
})();

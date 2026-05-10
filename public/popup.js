// popup.js - Extension popup logic

// Open dashboard link
document.getElementById('openDashboard').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// Sync buttons - use addEventListener (inline onclick blocked by MV3 CSP)
document.getElementById('syncBtn').addEventListener('click', () => startSync(false));
document.getElementById('fullSyncBtn').addEventListener('click', () => startSync(true));

// Load stats
function loadStats() {
  chrome.runtime.sendMessage({ type: 'GET_STATS' }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response) {
      document.getElementById('bookmarkCount').textContent = response.bookmarkCount || 0;
      document.getElementById('lastSync').textContent = response.lastSyncTime
        ? formatTime(response.lastSyncTime)
        : 'Never';
    }
  });
}

// Sync
function startSync(fullSync) {
  const btn = document.getElementById('syncBtn');
  const fullBtn = document.getElementById('fullSyncBtn');
  const status = document.getElementById('status');

  btn.disabled = true;
  fullBtn.disabled = true;
  status.className = 'status syncing';
  status.textContent = 'Syncing...';

  chrome.runtime.sendMessage({ type: 'START_SYNC', fullSync }, (response) => {
    if (chrome.runtime.lastError) {
      status.className = 'status error';
      status.textContent = 'Error: ' + chrome.runtime.lastError.message;
      btn.disabled = false;
      fullBtn.disabled = false;
      return;
    }
    if (response?.status === 'completed') {
      status.className = 'status success';
      status.textContent = `Done! ${response.newCount} new bookmarks.`;
      loadStats();
    } else if (response?.status === 'error') {
      status.className = 'status error';
      status.textContent = response.message;
    }
    btn.disabled = false;
    fullBtn.disabled = false;
  });
}

// Listen for sync updates from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SYNC_STATUS_UPDATE') {
    const status = document.getElementById('status');
    if (message.state === 'syncing') {
      status.className = 'status syncing';
      status.textContent = message.message;
    } else if (message.state === 'completed') {
      status.className = 'status success';
      status.textContent = message.message;
      loadStats();
    } else if (message.state === 'error') {
      status.className = 'status error';
      status.textContent = message.message;
    }
  }
});

function formatTime(isoStr) {
  const d = new Date(isoStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

// Initialize
loadStats();

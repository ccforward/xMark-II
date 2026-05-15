<template>
  <div class="stats-view">
    <div class="page-header">
      <h1 class="page-title">Settings</h1>
    </div>

    <!-- General -->
    <div class="stats-section">
      <h3>General</h3>
      <div class="form-group">
        <label class="form-label">Keyboard Shortcuts</label>
        <div class="shortcuts-list">
          <div class="shortcut-item"><kbd>/</kbd> Focus search</div>
          <div class="shortcut-item"><kbd>j</kbd> / <kbd>k</kbd> Navigate bookmarks</div>
          <div class="shortcut-item"><kbd>x</kbd> Toggle selection</div>
          <div class="shortcut-item"><kbd>o</kbd> Open on X</div>
          <div class="shortcut-item"><kbd>Esc</kbd> Close modal / lightbox</div>
          <div class="shortcut-item"><kbd>&larr;</kbd> / <kbd>&rarr;</kbd> Lightbox navigation</div>
        </div>
      </div>
    </div>

    <!-- AI Configuration -->
    <div class="stats-section">
      <h3>AI Processing</h3>

      <!-- Models -->
      <div class="form-group">
        <label class="form-label">Models</label>
        <div class="ai-models-list">
          <div v-for="model in localConfig.models" :key="model.id" class="ai-model-card" :class="{ active: model.id === localConfig.activeModelId }">
            <div class="ai-model-card-header">
              <span class="ai-model-name">{{ model.name }}</span>
              <span v-if="model.id === localConfig.activeModelId" class="ai-default-badge">Default</span>
              <span v-if="model.supportsVision" class="ai-vision-badge">Vision</span>
            </div>
            <div class="ai-model-detail">{{ model.model }} &middot; {{ shortenUrl(model.baseUrl) }}</div>
            <div class="ai-model-card-actions">
              <button v-if="model.id !== localConfig.activeModelId" class="btn btn-sm btn-secondary" @click="setActiveModel(model.id)">Set Default</button>
              <button class="btn btn-sm btn-secondary" @click="editModel(model)">Edit</button>
              <button class="btn btn-sm btn-secondary" style="color:var(--error)" @click="confirmRemoveModel(model.id, model.name)">Delete</button>
            </div>
          </div>
          <div v-if="localConfig.models.length === 0" class="ai-model-empty">No models configured. Add one to enable AI processing.</div>
        </div>
        <button class="btn btn-sm btn-primary" @click="addModel">+ Add Model</button>
      </div>

      <!-- Model Edit Form -->
      <div v-if="editingModel" class="ai-model-form">
        <h4>{{ editingModel._isNew ? 'Add Model' : 'Edit Model' }}</h4>
        <div class="form-row">
          <div class="form-group" style="flex:1">
            <label class="form-label">Display Name</label>
            <input v-model="editingModel.name" class="form-input" placeholder="e.g. GPT-4o" />
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label">Model ID</label>
            <input v-model="editingModel.model" class="form-input" placeholder="gpt-4o / qwen2.5:7b" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Base URL</label>
          <input v-model="editingModel.baseUrl" class="form-input" placeholder="https://api.openai.com/v1" />
        </div>
        <div class="form-group">
          <label class="form-label">API Key</label>
          <div class="api-key-input-wrap">
            <input v-model="editingModel.apiKey" :type="showApiKey ? 'text' : 'password'" class="form-input" placeholder="sk-... (leave empty for local models)" />
            <button type="button" class="btn btn-sm btn-secondary api-key-toggle" @click="showApiKey = !showApiKey">{{ showApiKey ? 'Hide' : 'Show' }}</button>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label checkbox-label">
            <input type="checkbox" v-model="editingModel.supportsVision" />
            Supports Vision (image analysis)
          </label>
        </div>
        <div class="ai-model-form-actions">
          <button class="btn btn-primary btn-sm" @click="saveModel">Save Model</button>
          <button class="btn btn-secondary btn-sm" @click="editingModel = null">Cancel</button>
        </div>
      </div>

      <!-- Auto-process -->
      <div class="form-group">
        <label class="form-label checkbox-label">
          <input type="checkbox" v-model="localConfig.autoProcessAfterSync" @change="saveAIConfig" />
          Auto-process new bookmarks after sync
        </label>
      </div>

      <!-- Output Language -->
      <div class="form-group">
        <label class="form-label">Output Language</label>
        <select v-model="localConfig.outputLanguage" class="form-input" @change="saveAIConfig">
          <option value="en">English</option>
          <option value="zh">Chinese</option>
          <option value="auto">Follow tweet language</option>
        </select>
      </div>

      <!-- System Prompt -->
      <div class="form-group">
        <label class="form-label">Custom System Prompt</label>
        <textarea v-model="localConfig.systemPrompt" class="form-input ai-prompt-textarea" placeholder="Leave empty to use default prompt..." rows="6" @blur="saveAIConfig"></textarea>
        <button v-if="localConfig.systemPrompt" class="btn btn-sm btn-secondary" style="margin-top:4px" @click="localConfig.systemPrompt = ''; saveAIConfig()">Reset to Default</button>
      </div>
      <div class="form-group">
        <label class="form-label" style="cursor:pointer" @click="showDefaultPrompt = !showDefaultPrompt">
          Default System Prompt <span style="font-size:11px;opacity:0.6">{{ showDefaultPrompt ? '▲ Hide' : '▼ Show' }}</span>
        </label>
        <pre v-if="showDefaultPrompt" class="default-prompt-display">{{ DEFAULT_SYSTEM_PROMPT }}</pre>
      </div>
    </div>

    <!-- Token Usage Stats -->
    <div class="stats-section">
      <h3>Token Usage</h3>
      <div v-if="tokenStats" class="token-usage-panel">
        <!-- Summary Cards -->
        <div class="token-summary-cards">
          <div class="token-card">
            <div class="token-card-label">Total Usage</div>
            <div class="token-card-value">{{ formatNum(tokenStats.total.totalTokens) }}</div>
            <div class="token-card-sub">{{ tokenStats.total.requests }} requests</div>
          </div>
          <div class="token-card">
            <div class="token-card-label">This Month</div>
            <div class="token-card-value">{{ formatNum(tokenStats.monthTotal.totalTokens) }}</div>
            <div class="token-card-sub">{{ tokenStats.monthTotal.requests }} requests</div>
          </div>
          <div class="token-card">
            <div class="token-card-label">Prompt Tokens</div>
            <div class="token-card-value">{{ formatNum(tokenStats.total.promptTokens) }}</div>
            <div class="token-card-sub">{{ Math.round(tokenStats.total.promptTokens / (tokenStats.total.totalTokens || 1) * 100) }}% of total</div>
          </div>
          <div class="token-card">
            <div class="token-card-label">Completion Tokens</div>
            <div class="token-card-value">{{ formatNum(tokenStats.total.completionTokens) }}</div>
            <div class="token-card-sub">{{ Math.round(tokenStats.total.completionTokens / (tokenStats.total.totalTokens || 1) * 100) }}% of total</div>
          </div>
        </div>

        <!-- By Model Summary -->
        <div v-if="tokenStats.modelNames.length > 0" class="token-model-summary">
          <div v-for="model in tokenStats.modelNames" :key="model" class="token-model-chip">
            <span class="token-model-name">{{ model }}</span>
            <span class="token-model-tokens">{{ formatNum(tokenStats.byModel[model].totalTokens) }}</span>
          </div>
        </div>

        <!-- Daily Table -->
        <div v-if="tokenStats.dailyRecords.length > 0" class="token-table-wrap">
          <table class="token-table">
            <thead>
              <tr>
                <th>Date</th>
                <th v-for="model in tokenStats.modelNames" :key="model">{{ model }}</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in paginatedRecords" :key="row.date">
                <td class="token-table-date">{{ row.date }}</td>
                <td v-for="model in tokenStats.modelNames" :key="model" class="token-table-cell">
                  {{ row.models[model] ? formatNum(row.models[model].totalTokens) : '-' }}
                </td>
                <td class="token-table-total">{{ formatNum(row.totalTokens) }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="totalPages > 1" class="token-table-pagination">
            <button class="btn btn-sm btn-secondary" :disabled="currentPage === 1" @click="currentPage--">&laquo; Prev</button>
            <span class="token-page-info">{{ currentPage }} / {{ totalPages }}</span>
            <button class="btn btn-sm btn-secondary" :disabled="currentPage === totalPages" @click="currentPage++">Next &raquo;</button>
          </div>
        </div>
      </div>
      <div v-else class="ai-model-empty">No usage data yet</div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { getDB } from '../../db.js'
import { DEFAULT_SYSTEM_PROMPT } from '../../ai/aiPrompts.js'

const props = defineProps({
  aiConfig: Object,
})

const emit = defineEmits(['save-ai-config'])

const localConfig = reactive({
  models: [],
  activeModelId: null,
  autoProcessAfterSync: true,
  systemPrompt: '',
  outputLanguage: 'en',
})

const editingModel = ref(null)
const showApiKey = ref(false)
const showDefaultPrompt = ref(false)
const tokenStats = ref(null)
const currentPage = ref(1)
const pageSize = 10

const totalPages = computed(() => {
  if (!tokenStats.value?.dailyRecords) return 1
  return Math.ceil(tokenStats.value.dailyRecords.length / pageSize)
})

const paginatedRecords = computed(() => {
  if (!tokenStats.value?.dailyRecords) return []
  const start = (currentPage.value - 1) * pageSize
  return tokenStats.value.dailyRecords.slice(start, start + pageSize)
})

onMounted(async () => {
  if (props.aiConfig) {
    Object.assign(localConfig, JSON.parse(JSON.stringify(props.aiConfig)))
  }
  const db = await getDB()
  tokenStats.value = await db.getTokenUsageStats()
})

watch(() => props.aiConfig, (val) => {
  if (val) Object.assign(localConfig, JSON.parse(JSON.stringify(val)))
})

function addModel() {
  showApiKey.value = false
  editingModel.value = {
    _isNew: true,
    id: crypto.randomUUID(),
    name: '',
    baseUrl: '',
    apiKey: '',
    model: '',
    supportsVision: false,
  }
}

function editModel(model) {
  showApiKey.value = false
  editingModel.value = { ...model, _isNew: false }
}

function saveModel() {
  const m = editingModel.value
  // Trim all string fields
  m.name = (m.name || '').trim()
  m.baseUrl = (m.baseUrl || '').trim()
  m.apiKey = (m.apiKey || '').trim()
  m.model = (m.model || '').trim()
  if (!m.name || !m.baseUrl || !m.model) return
  const { _isNew, ...modelData } = m
  const idx = localConfig.models.findIndex(x => x.id === modelData.id)
  if (idx >= 0) {
    localConfig.models[idx] = modelData
  } else {
    localConfig.models.push(modelData)
  }
  if (!localConfig.activeModelId) localConfig.activeModelId = modelData.id
  editingModel.value = null
  saveAIConfig()
}

function confirmRemoveModel(id, name) {
  if (!confirm(`Delete model "${name}"? This cannot be undone.`)) return
  removeModel(id)
}

function removeModel(id) {
  localConfig.models = localConfig.models.filter(m => m.id !== id)
  if (localConfig.activeModelId === id) {
    localConfig.activeModelId = localConfig.models[0]?.id || null
  }
  saveAIConfig()
}

function setActiveModel(id) {
  localConfig.activeModelId = id
  saveAIConfig()
}

function shortenUrl(url) {
  try { return new URL(url).host } catch { return url?.slice(0, 30) || '' }
}

function formatNum(n) {
  if (!n) return '0'
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

function saveAIConfig() {
  const { ...config } = localConfig
  emit('save-ai-config', config)
}
</script>

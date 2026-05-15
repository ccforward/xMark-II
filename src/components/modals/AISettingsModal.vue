<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal ai-settings-modal">
      <h2 class="modal-title">AI Settings</h2>

      <!-- Models -->
      <div class="form-group">
        <label class="form-label">Models</label>
        <div class="ai-models-list">
          <div v-for="model in localConfig.models" :key="model.id" class="ai-model-item" :class="{ active: model.id === localConfig.activeModelId }">
            <div class="ai-model-info">
              <span class="ai-model-name">{{ model.name }}</span>
              <span class="ai-model-detail">{{ model.model }} @ {{ shortenUrl(model.baseUrl) }}</span>
            </div>
            <div class="ai-model-actions">
              <button class="icon-btn" title="Set active" @click="localConfig.activeModelId = model.id">
                <span v-if="model.id === localConfig.activeModelId" class="active-dot"></span>
                <span v-else class="inactive-dot"></span>
              </button>
              <button class="icon-btn" title="Edit" @click="editModel(model)">
                <PenLine :size="14" />
              </button>
              <button class="icon-btn" title="Delete" @click="removeModel(model.id)">
                <Trash2 :size="14" />
              </button>
            </div>
          </div>
          <div v-if="localConfig.models.length === 0" class="ai-model-empty">No models configured</div>
        </div>
        <button class="btn btn-sm btn-secondary" @click="addModel">+ Add Model</button>
      </div>

      <!-- Model Edit Form -->
      <div v-if="editingModel" class="ai-model-form">
        <h4>{{ editingModel._isNew ? 'Add Model' : 'Edit Model' }}</h4>
        <div class="form-group">
          <label class="form-label">Name</label>
          <input v-model="editingModel.name" class="form-input" placeholder="e.g. GPT-4o" />
        </div>
        <div class="form-group">
          <label class="form-label">Base URL</label>
          <input v-model="editingModel.baseUrl" class="form-input" placeholder="https://api.openai.com/v1" />
        </div>
        <div class="form-group">
          <label class="form-label">API Key</label>
          <input v-model="editingModel.apiKey" type="password" class="form-input" placeholder="sk-... (empty for local models)" />
        </div>
        <div class="form-group">
          <label class="form-label">Model</label>
          <input v-model="editingModel.model" class="form-input" placeholder="gpt-4o / qwen2.5:7b" />
        </div>
        <div class="form-group">
          <label class="form-label checkbox-label">
            <input type="checkbox" v-model="editingModel.supportsVision" />
            Supports Vision (image analysis)
          </label>
        </div>
        <div class="ai-model-form-actions">
          <button class="btn btn-primary btn-sm" @click="saveModel">Save</button>
          <button class="btn btn-secondary btn-sm" @click="editingModel = null">Cancel</button>
        </div>
      </div>

      <!-- Auto-process -->
      <div class="form-group">
        <label class="form-label checkbox-label">
          <input type="checkbox" v-model="localConfig.autoProcessAfterSync" />
          Auto-process new bookmarks after sync
        </label>
      </div>

      <!-- Output Language -->
      <div class="form-group">
        <label class="form-label">Output Language</label>
        <select v-model="localConfig.outputLanguage" class="form-input">
          <option value="en">English</option>
          <option value="zh">Chinese</option>
          <option value="auto">Follow tweet language</option>
        </select>
      </div>

      <!-- System Prompt -->
      <div class="form-group">
        <label class="form-label">Custom System Prompt</label>
        <textarea v-model="localConfig.systemPrompt" class="form-input ai-prompt-textarea" placeholder="Leave empty to use default prompt..." rows="5"></textarea>
        <button v-if="localConfig.systemPrompt" class="btn btn-sm btn-secondary" style="margin-top:4px" @click="localConfig.systemPrompt = ''">Reset to Default</button>
      </div>

      <!-- Actions -->
      <div class="modal-actions">
        <button class="btn btn-primary" @click="save">Save</button>
        <button class="btn btn-secondary" @click="$emit('close')">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { PenLine, Trash2 } from 'lucide-vue-next'

const emit = defineEmits(['close', 'save'])
const props = defineProps({ config: Object })

const localConfig = reactive({
  models: [],
  activeModelId: null,
  autoProcessAfterSync: true,
  systemPrompt: '',
  outputLanguage: 'en',
})

const editingModel = ref(null)

onMounted(() => {
  if (props.config) {
    Object.assign(localConfig, JSON.parse(JSON.stringify(props.config)))
  }
})

function addModel() {
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
  editingModel.value = { ...model, _isNew: false }
}

function saveModel() {
  const m = editingModel.value
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
}

function removeModel(id) {
  localConfig.models = localConfig.models.filter(m => m.id !== id)
  if (localConfig.activeModelId === id) {
    localConfig.activeModelId = localConfig.models[0]?.id || null
  }
}

function shortenUrl(url) {
  try { return new URL(url).host } catch { return url?.slice(0, 30) || '' }
}

function save() {
  const { ...config } = localConfig
  emit('save', config)
  emit('close')
}
</script>

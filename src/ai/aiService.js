// aiService.js - OpenAI-compatible API client

async function imageUrlToBase64(url) {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const blob = await response.blob()
    const buffer = await blob.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
    const mimeType = blob.type || 'image/jpeg'
    return `data:${mimeType};base64,${base64}`
  } catch (e) {
    console.warn('[AI] Failed to fetch image for base64:', url, e.message)
    return null
  }
}

export class AIService {
  constructor(config) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.apiKey = config.apiKey
    this.model = config.model
    this.modelName = config.name || config.model
    this.supportsVision = config.supportsVision || false
  }

  async chat(messages, options = {}) {
    const headers = { 'Content-Type': 'application/json' }
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    const body = {
      model: this.model,
      messages,
      temperature: options.temperature ?? 0.3,
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`AI API error ${response.status}: ${text.slice(0, 200)}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    const usage = data.usage || null
    return { content, usage }
  }

  async chatWithVision(messages, imageUrls) {
    if (!this.supportsVision || !imageUrls?.length) {
      return this.chat(messages)
    }

    // Download images and convert to base64 data URIs
    const base64Urls = await Promise.all(
      imageUrls.slice(0, 4).map(url => imageUrlToBase64(url))
    )
    const validUrls = base64Urls.filter(Boolean)

    if (validUrls.length === 0) {
      return this.chat(messages)
    }

    // Convert the last user message to include image content parts
    const augmented = [...messages]
    const lastMsg = augmented[augmented.length - 1]
    if (lastMsg.role === 'user') {
      const content = [
        { type: 'text', text: lastMsg.content },
        ...validUrls.map(url => ({
          type: 'image_url',
          image_url: { url, detail: 'low' },
        })),
      ]
      augmented[augmented.length - 1] = { role: 'user', content }
    }

    return this.chat(augmented)
  }
}

export function createAIService(modelConfig) {
  return new AIService(modelConfig)
}

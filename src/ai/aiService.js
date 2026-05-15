// aiService.js - OpenAI-compatible API client

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

    // Convert the last user message to include image content parts
    const augmented = [...messages]
    const lastMsg = augmented[augmented.length - 1]
    if (lastMsg.role === 'user') {
      const content = [
        { type: 'text', text: lastMsg.content },
        ...imageUrls.slice(0, 4).map(url => ({
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

// aiProcessor.js - Batch processing engine

import { createAIService } from './aiService.js'
import { getSystemPrompt, buildUserPrompt, parseAIResponse } from './aiPrompts.js'
import { getDB } from '../db.js'

export class AIProcessor {
  constructor(modelConfig, aiConfig) {
    this.service = createAIService(modelConfig)
    this.config = aiConfig
    this.modelName = modelConfig.name || modelConfig.model
    this.supportsVision = modelConfig.supportsVision || false
  }

  async processUnprocessed(onProgress) {
    const db = await getDB()
    const unprocessed = await db.getUnprocessedBookmarks()
    if (unprocessed.length === 0) return { processed: 0, total: 0 }

    const collections = await db.getAllCollections()
    const existingTags = await db.getAllTags()
    const total = unprocessed.length
    let processed = 0

    // Split into batches: image tweets single, text-only in groups of 5
    const batches = this._buildBatches(unprocessed)

    for (const batch of batches) {
      try {
        await this._processBatch(batch, collections, existingTags, db)
      } catch (e) {
        console.error('[AI] Batch failed:', e.message)
      }
      processed += batch.length
      if (onProgress) onProgress({ processed, total, current: batch[0]?.tweetId })
    }

    return { processed, total }
  }

  async processSingle(bookmarkId) {
    const db = await getDB()
    const bookmark = await db.bookmarks.get(bookmarkId)
    if (!bookmark) throw new Error('Bookmark not found')

    const collections = await db.getAllCollections()
    const existingTags = await db.getAllTags()
    await this._processBatch([bookmark], collections, existingTags, db)
    return await db.bookmarks.get(bookmarkId)
  }

  _buildBatches(bookmarks) {
    const batches = []
    const textOnly = []

    for (const bm of bookmarks) {
      if (bm.mediaUrls?.length > 0 && this.supportsVision) {
        // Image tweets go solo for vision processing
        batches.push([bm])
      } else {
        textOnly.push(bm)
      }
    }

    // Chunk text-only into groups of 5
    for (let i = 0; i < textOnly.length; i += 5) {
      batches.push(textOnly.slice(i, i + 5))
    }

    return batches
  }

  async _processBatch(bookmarks, collections, existingTags, db) {
    const systemPrompt = getSystemPrompt(this.config)
    const userPrompt = buildUserPrompt(bookmarks, collections, existingTags)

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]

    let response
    // Single tweet with images → use vision
    if (bookmarks.length === 1 && bookmarks[0].mediaUrls?.length > 0 && this.supportsVision) {
      // Use small thumbnails to reduce token cost
      const smallUrls = bookmarks[0].mediaUrls.slice(0, 2).map(url => {
        if (url.includes('pbs.twimg.com')) return url.split('?')[0] + '?format=jpg&name=small'
        return url
      })
      response = await this.service.chatWithVision(messages, smallUrls)
    } else {
      response = await this.service.chat(messages)
    }

    const { content: responseText, usage } = response

    // Record token usage
    if (usage) {
      await db.recordTokenUsage({
        model: this.modelName,
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
        batchSize: bookmarks.length,
        timestamp: new Date().toISOString(),
      })
    }

    const results = parseAIResponse(responseText)
    if (!results) return

    // Apply results to bookmarks
    for (let i = 0; i < bookmarks.length && i < results.length; i++) {
      const bm = bookmarks[i]
      const result = results[i]
      await this._applyResult(bm, result, db)
    }
  }

  async _applyResult(bookmark, result, db) {
    const updates = {
      ai_processed: true,
      ai_processed_at: new Date().toISOString(),
      ai_summary: result.summary || null,
      ai_tags: result.tags || [],
      ai_collection: result.collection || null,
      ai_collection_is_new: result.is_new_collection || false,
      ai_vision_notes: result.vision_notes || null,
    }

    // Merge AI tags into bookmark's tags
    if (result.tags?.length > 0) {
      const existingTags = bookmark.tags || []
      const mergedTags = [...new Set([...existingTags, ...result.tags])]
      updates.tags = mergedTags

      // Ensure tags exist in the tags table
      for (const tagName of result.tags) {
        const existing = await db.tags.where('name').equals(tagName).first()
        if (!existing) {
          await db.addTag(tagName)
        }
      }
    }

    // Handle collection assignment
    if (result.collection) {
      let col = (await db.getAllCollections()).find(c => c.name === result.collection)
      if (!col && result.is_new_collection) {
        const colId = await db.createCollection(result.collection)
        col = await db.collections.get(colId)
      }
      if (col) {
        await db.addBookmarkToCollection(col.id, bookmark.id)
      }
    }

    await db.bookmarks.update(bookmark.id, updates)
  }
}

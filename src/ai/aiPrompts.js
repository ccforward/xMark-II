// aiPrompts.js - Prompt templates and response parsing

export const DEFAULT_SYSTEM_PROMPT = `You are an AI assistant that analyzes bookmarked tweets. For each tweet, return a JSON object with:

1. "tags": Array of 3-5 multi-dimensional tags (NO MORE than 5). Include:
   - Content topic tags (e.g. "Node.js", "NetworkSecurity", "Finance")
   - Format/type tags (e.g. "Tool", "Long-form", "Hot-take", "Tutorial", "Thread")
   - Action tags if applicable (e.g. "To-Try", "To-Read", "Reference")
   IMPORTANT: Prefer reusing tags from the "Existing tags" list when they are relevant. Only create new tags when no existing tag fits. Avoid creating tags that are synonyms or slight variations of existing ones.

2. "collection": The best-fitting collection name from the provided list, or a new suggested name.
   "is_new_collection": true if suggesting a new collection not in the list.

3. "summary": {
   "coreInsight": One sentence summarizing the key point,
   "keyLinks": Array of important URLs/resources mentioned,
   "actionItems": Array of suggested next steps (e.g. "Star repo X", "Try library Y"),
   "codeSnippet": The most relevant code snippet if the tweet contains code, else null
}

4. "vision_notes": If images are provided, describe what's in them that's relevant to the content. Focus on diagrams, code screenshots, data visualizations, or key information not in the text.

Return ONLY valid JSON. No markdown fences. Array of objects if multiple tweets.`

export function getSystemPrompt(config) {
  const base = config.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT
  const langNote = config.outputLanguage === 'zh'
    ? '\n\nIMPORTANT: All output text (tags, summaries, action items) must be in Chinese.'
    : config.outputLanguage === 'auto'
      ? '\n\nIMPORTANT: Output in the same language as the tweet content.'
      : ''
  return base + langNote
}

export function buildUserPrompt(tweets, existingCollections = [], existingTags = []) {
  const collectionNames = existingCollections.map(c => c.name)
  let prompt = ''

  if (existingTags.length > 0) {
    // Send up to 50 most relevant tags to keep prompt concise
    const tagNames = existingTags.slice(0, 50).map(t => typeof t === 'string' ? t : t.name)
    prompt += `Existing tags: ${JSON.stringify(tagNames)}\n\n`
  }

  if (collectionNames.length > 0) {
    prompt += `Existing collections: ${JSON.stringify(collectionNames)}\n\n`
  }

  if (tweets.length === 1) {
    const t = tweets[0]
    prompt += formatTweet(t)
  } else {
    prompt += `Analyze these ${tweets.length} tweets and return a JSON array:\n\n`
    tweets.forEach((t, i) => {
      prompt += `--- Tweet ${i + 1} ---\n${formatTweet(t)}\n`
    })
  }

  return prompt
}

function formatTweet(t) {
  const text = (t.text || t.noteText || '').slice(0, 500)
  let result = `@${t.authorHandle}: ${text}`
  if (t.urls?.length) result += `\nLinks: ${t.urls.slice(0, 3).join(', ')}`
  if (t.quotedTweet) result += `\nQuoted: @${t.quotedTweet.authorHandle}: ${(t.quotedTweet.text || '').slice(0, 200)}`
  if (t.article) result += `\nArticle: ${(t.article.title || '').slice(0, 100)}`
  return result
}

export function parseAIResponse(responseText) {
  // Strip markdown fences if present
  let cleaned = responseText.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  }

  try {
    const parsed = JSON.parse(cleaned)
    // Normalize to array
    const results = Array.isArray(parsed) ? parsed : [parsed]
    return results.map(normalizeResult)
  } catch (e) {
    console.warn('[AI] Failed to parse response:', e.message, responseText.slice(0, 200))
    return null
  }
}

function normalizeResult(r) {
  return {
    tags: Array.isArray(r.tags) ? r.tags.filter(t => typeof t === 'string').slice(0, 5) : [],
    collection: typeof r.collection === 'string' ? r.collection : null,
    is_new_collection: !!r.is_new_collection,
    summary: r.summary ? {
      coreInsight: r.summary.coreInsight || '',
      keyLinks: Array.isArray(r.summary.keyLinks) ? r.summary.keyLinks : [],
      actionItems: Array.isArray(r.summary.actionItems) ? r.summary.actionItems : [],
      codeSnippet: r.summary.codeSnippet || null,
    } : null,
    vision_notes: typeof r.vision_notes === 'string' ? r.vision_notes : null,
  }
}

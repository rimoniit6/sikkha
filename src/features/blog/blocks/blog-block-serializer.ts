import type { BlogContentBlock } from './blog-block-types'
import { blogGenerateId } from './blog-block-types'

export function serializeBlogBlocks(blocks: BlogContentBlock[]): string {
  return JSON.stringify(blocks)
}

export function deserializeBlogBlocks(content: string | null): BlogContentBlock[] {
  if (!content) return []
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) return parsed
    return [{ id: blogGenerateId(), type: 'text', content }]
  } catch {
    return [{ id: blogGenerateId(), type: 'text', content }]
  }
}
